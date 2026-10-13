# Persistent Database Product Image Storage & Cloud Synchronization

Store product images directly in the Supabase `inventory` table and synchronize seamlessly across devices, with intelligent schema detection, automated migration guidance, and resilient local-to-cloud cache merging so photos are never lost upon reload.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed in Phase 1:
> - **Storage Destination**: Directly in the `inventory` table column (`image_url` TEXT) in Supabase.
> - **Cache & Sync Strategy**: Merge database rows with local cache during load so existing product photos are never overwritten with null values if remote sync is in progress or column is freshly created.
> - **Schema Migration & Safety**: If the remote Supabase database table does not yet have the `image_url` column, provide an automated SQL command / migration banner in the UI so the store manager can run `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;` with 1 click, while retaining all photos safely in persistent client storage (IndexedDB / LocalStorage) in the meantime.

---

## 1. Overview & Core Concept

When adding or updating products in the Inventory Manager, users upload or photograph product images. Previously, if the remote Supabase table schema didn't have the `image_url` column configured, the app fell back to stripping the image during database insert/update, causing subsequent database fetches (`loadDataFromSupabase`) to overwrite the local state and make images disappear on reload.

This feature ensures:
1. **Direct Database Persistence**: Images are saved in the `image_url` column of the `inventory` table in Supabase.
2. **Defensive Cache Merging**: When fetching from Supabase, if a remote record has no image or an empty string, any existing high-resolution locally saved image for that product ID is preserved rather than overwritten with `undefined`.
3. **Database Schema Helper & Status**: The app detects whether `image_url` is supported by Supabase. If missing, it alerts the user with a clean, copyable SQL migration snippet and status indicator, without interrupting store operations.
4. **Reliable Storage Engine**: Compressed images are persisted via an IndexedDB-backed storage helper alongside localStorage to avoid hitting browser 5MB localStorage quota limits.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Add / Edit Product with Image**:
   - User snaps a photo or uploads an image file in the Inventory Manager modal.
   - The image is compressed into an optimized JPEG string (~30–50KB).
   - Upon clicking "Save Product", the item is saved to local persistent storage immediately and sent to Supabase with the `image_url` field populated.
2. **App Reload & Cross-Session Access**:
   - On page refresh or new session login, `loadDataFromSupabase` queries `inventory`.
   - The merge logic combines remote fields (prices, stock quantities, updates) with locally cached images. Even if the remote database column is still being created or empty, the product photo remains visible in the inventory list, cards, and POS terminal.
3. **Database Schema Readiness Indicator**:
   - In the Settings or Database status section, an indicator displays "Product Image Column: Synced & Ready".
   - If Supabase rejects `image_url` due to missing schema column, an unobtrusive banner with a one-click "Copy SQL Query" button is displayed:
     ```sql
     ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;
     ```
   - Once executed in the Supabase SQL editor, the app detects the column and immediately syncs all cached local images to the database.

### Visual Identity & Theme
- **Theme Consistency**: Matches existing deep navy/indigo palette (`#4F46E5`, `#0F172A`), dark mode support, and clean utilitarian POS layout.
- **Micro-Interactions**: Sync badge transitions smoothly between "Synced", "Syncing...", and "Local Cache Protected".
- **Zero-Pill Restraint**: Status badges use crisp typographical layout and subtle icons without bloated pill wraps.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Direct Table Column Storage vs. Object Storage Bucket
- **Chosen Approach**: Direct `image_url TEXT` column on `inventory` storing optimized base64 or hosted URLs.
- **Why**: Eliminates the need for configuring Supabase Storage bucket RLS policies, public access permissions, and multi-part upload handlers. At ~30-50KB per compressed JPEG, standard PostgreSQL TEXT columns handle thousands of inventory items effortlessly.
- **Alternative Considered**: Supabase Storage Buckets. Required bucket creation, storage quotas, and complex RLS setups that could fail if credentials lack bucket admin privileges.

### Decision 2: Cache Merging Protocol
- **Chosen Approach**: Two-way resilient merge. If `invData` from Supabase has a valid `imageUrl`, it takes precedence; if remote is null/empty but local cache has an image, keep the local image and schedule a background upsert to heal the database.
- **Why**: Prevents accidental data wipeouts on app refresh or network hiccups.

### Decision 3: IndexedDB Storage Fallback
- **Chosen Approach**: Hybrid IndexedDB + LocalStorage storage adapter for product photos.
- **Why**: Browser `localStorage` has a strict ~5MB limit across the entire origin. For stores with 50+ photographed items, base64 strings could exceed this limit. IndexedDB provides hundreds of megabytes of reliable offline storage.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Web App                          │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   Inventory Manager   │       │   Sales POS Terminal  │  │
│  │ (Upload / Camera UI)  │       │ (Grid & Cart Preview) │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              ▼                               ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Inventory State & Image Store              │  │
│  │  - Optimistic Local UI Update                         │  │
│  │  - IndexedDB / LocalStorage Persistent Cache          │  │
│  │  - Merge Resolver (Remote ↔ Local)                    │  │
│  └───────────┬───────────────────────────────▲───────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               │                               │
        Insert / Update                 Fetch on load
               │                               │
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                    Supabase Database                        │
│                                                             │
│  Table: `inventory`                                         │
│  Columns: id, name, category, quantity, cost_price,         │
│           sales_price, low_stock_threshold, last_updated,   │
│           image_url (TEXT)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow & Handlers
1. **`App.tsx` (`loadDataFromSupabase`)**:
   - Fetches `inventory` from Supabase.
   - Merges remote items with existing state:
     `imageUrl: (remoteImg && remoteImg.trim() !== '') ? remoteImg : (existingLocalItem?.imageUrl || undefined)`
   - Stores merged list into persistent cache.
2. **`App.tsx` (`handleAddProduct` & `handleUpdateItem`)**:
   - Sends payload including `image_url: item.imageUrl`.
   - On success, marks item as synced.
   - If Supabase returns schema error `column "image_url" does not exist`, retains image in local persistent store, triggers the schema helper notice, and retries the core product fields without failing the user's action.
3. **Database Schema Guide Modal / Component**:
   - Provides clear instructions and copy button for the exact SQL statement if the user's Supabase instance requires column creation.
