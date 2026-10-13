/**
 * Database Schema and Image Column Sync Helper
 *
 * Verifies Supabase schema capabilities, provides 1-click migration SQL statements,
 * and handles mass-sync of locally cached product images to the Supabase inventory table.
 */

import { supabase } from './supabaseClient';
import { InventoryItem } from '../types';
import { getCachedImageSync } from './imageCache';

export const ADD_IMAGE_URL_SQL = `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;`;

export interface SchemaCheckResult {
  hasImageUrlColumn: boolean;
  detectedColumnName: string;
  checkedAt: string;
  errorMessage?: string;
}

/**
 * Probes the Supabase inventory table to verify if image_url (or equivalent) column exists.
 */
export async function checkImageUrlColumnSupport(): Promise<SchemaCheckResult> {
  const result: SchemaCheckResult = {
    hasImageUrlColumn: false,
    detectedColumnName: 'image_url',
    checkedAt: new Date().toISOString()
  };

  try {
    // 1. Try querying specifically the image_url column
    const { data, error } = await supabase
      .from('inventory')
      .select('image_url')
      .limit(1);

    if (!error) {
      result.hasImageUrlColumn = true;
      result.detectedColumnName = 'image_url';
      return result;
    }

    // Check if error is because column does not exist
    const errText = (error.message || '').toLowerCase();
    const isMissingColumn =
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      errText.includes('could not find') ||
      errText.includes('column') ||
      errText.includes('schema cache');

    if (isMissingColumn) {
      // Check if alternative column names like 'image' or 'imageUrl' exist
      const altCheck = await supabase.from('inventory').select('image').limit(1);
      if (!altCheck.error) {
        result.hasImageUrlColumn = true;
        result.detectedColumnName = 'image';
        return result;
      }

      result.hasImageUrlColumn = false;
      result.errorMessage = error.message;
      return result;
    }

    // Other errors (e.g. table not found or auth)
    result.hasImageUrlColumn = false;
    result.errorMessage = error.message;
    return result;
  } catch (err: any) {
    result.hasImageUrlColumn = false;
    result.errorMessage = err?.message || 'Network error while checking schema';
    return result;
  }
}

/**
 * Pushes all products that have local pictures up to the Supabase inventory table.
 * Ideal when the user has just run the ALTER TABLE statement or wants to ensure full sync.
 */
export async function pushLocalImagesToDatabase(
  inventory: InventoryItem[],
  columnName = 'image_url',
  onProgress?: (synced: number, total: number) => void
): Promise<{ syncedCount: number; failedCount: number; errors: string[] }> {
  const itemsWithImages = inventory.filter((item) => {
    const img = item.imageUrl || getCachedImageSync(item.id);
    return typeof img === 'string' && img.trim().length > 0;
  });

  const total = itemsWithImages.length;
  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < total; i++) {
    const item = itemsWithImages[i];
    const imgData = item.imageUrl || getCachedImageSync(item.id);

    try {
      const payload: Record<string, any> = {
        [columnName]: imgData,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('id', item.id);

      if (error) {
        failedCount++;
        errors.push(`${item.name}: ${error.message}`);
      } else {
        syncedCount++;
      }
    } catch (err: any) {
      failedCount++;
      errors.push(`${item.name}: ${err.message || 'Unknown error'}`);
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { syncedCount, failedCount, errors };
}
