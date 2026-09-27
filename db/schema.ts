import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  spis: text('spis').notNull(),
  publishedAt: text('published_at').notNull(),
  description: text('description').notNull(),
  documentUrl: text('document_url').notNull(),
  verdict: text('verdict').notNull(),
});
export const findings = sqliteTable('findings', {
  eventId: integer('event_id').primaryKey(),
  spis: text('spis').notNull(),
  publishedAt: text('published_at').notNull(),
  detectedAt: text('detected_at').notNull(),
  district: text('district').notNull(),
  city: text('city').notNull(),
  kind: text('kind').notNull(),
  lv: text('lv').notNull().default(''),
  parcel: text('parcel').notNull().default(''),
  description: text('description').notNull(),
  documentUrl: text('document_url').notNull(),
}, (table) => [index('findings_detected_idx').on(table.detectedAt)]);
