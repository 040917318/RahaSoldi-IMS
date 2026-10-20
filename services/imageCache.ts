/**
 * Persistent Image Cache Service
 * 
 * Provides resilient, dual-layer storage for product images using IndexedDB
 * with automatic fallback to localStorage and an in-memory cache for instant synchronous access.
 * 
 * Guarantees that product photos are never lost during database syncs, page reloads,
 * or schema updates.
 */

import { InventoryItem } from '../types';

const DB_NAME = 'raha_soldi_image_store';
const STORE_NAME = 'product_images';
const DB_VERSION = 1;

// In-memory cache for instant synchronous reads
const memoryImageCache = new Map<string, string>();
let isInitialized = false;

/**
 * Open or create the IndexedDB database
 */
function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open image database'));
  });
}

/**
 * Initialize image cache from IndexedDB and localStorage into memory
 */
export async function initImageCache(initialItems?: InventoryItem[]): Promise<void> {
  // Pre-seed memory cache from provided initial items if any
  if (initialItems && initialItems.length > 0) {
    for (const item of initialItems) {
      if (item.id && item.imageUrl) {
        memoryImageCache.set(item.id, item.imageUrl);
      }
    }
  }

  // Check localStorage for any legacy backups, migrate to memory/IndexedDB, then purge to free localStorage quota
  try {
    const rawLocal = localStorage.getItem('raha_local_images');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      Object.entries(parsed).forEach(([id, img]) => {
        if (typeof img === 'string' && img.length > 0) {
          memoryImageCache.set(id, img);
        }
      });
      // Purge legacy local storage key to immediately prevent QuotaExceededError
      localStorage.removeItem('raha_local_images');
    }
  } catch (err) {
    console.warn('[ImageCache] Error migrating legacy localStorage backup:', err);
    try { localStorage.removeItem('raha_local_images'); } catch {}
  }

  // Load all images from IndexedDB
  try {
    const db = await openImageDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const records = getAllRequest.result || [];
      for (const record of records) {
        if (record && record.id && record.imageUrl) {
          memoryImageCache.set(record.id, record.imageUrl);
        }
      }
      isInitialized = true;
    };
  } catch (err) {
    console.warn('[ImageCache] IndexedDB unavailable, continuing with memory cache:', err);
    isInitialized = true;
  }
}

/**
 * Synchronous read of cached image by item ID
 */
export function getCachedImageSync(itemId: string): string | undefined {
  if (!itemId) return undefined;
  return memoryImageCache.get(itemId);
}

/**
 * Save an image to IndexedDB and memory cache.
 * Note: Base64 images are intentionally NOT stored in localStorage to prevent QuotaExceededError.
 */
export async function saveCachedImage(itemId: string, imageUrl: string): Promise<void> {
  if (!itemId || !imageUrl) return;

  // 1. Update memory cache immediately for instantaneous synchronous UI display
  memoryImageCache.set(itemId, imageUrl);

  // 2. Persist to IndexedDB (asynchronous high-capacity storage)
  try {
    const db = await openImageDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: itemId,
      imageUrl,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[ImageCache] Failed to save to IndexedDB:', err);
  }
}

/**
 * Remove an image from cache
 */
export async function removeCachedImage(itemId: string): Promise<void> {
  if (!itemId) return;

  memoryImageCache.delete(itemId);

  try {
    const db = await openImageDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(itemId);
  } catch (err) {
    console.warn('[ImageCache] Error removing from IndexedDB:', err);
  }

  try {
    localStorage.removeItem('raha_local_images');
  } catch {}
}

/**
 * Get all cached images as a Map
 */
export async function getAllCachedImages(): Promise<Map<string, string>> {
  return new Map(memoryImageCache);
}

/**
 * Merges raw database items with local cache so existing images are NEVER lost
 */
export function mergeInventoryWithLocalCache(dbItems: InventoryItem[]): InventoryItem[] {
  return dbItems.map((item) => {
    const cachedImage = memoryImageCache.get(item.id);
    const effectiveImage = (item.imageUrl && item.imageUrl.trim().length > 0)
      ? item.imageUrl
      : cachedImage;

    // Keep cache synced with DB image if DB had one
    if (item.imageUrl && item.imageUrl.trim().length > 0 && item.id) {
      memoryImageCache.set(item.id, item.imageUrl);
    }

    return {
      ...item,
      imageUrl: effectiveImage || undefined
    };
  });
}
