export type OwnerFeature = 'favorite' | 'saved_filter';
export type OwnerStorageConfig = { url: string; secret: string; ownerId: string };
export type SavedFilter = { id: string; name: string; criteria: Record<string, unknown>; created_at: string; updated_at: string };
