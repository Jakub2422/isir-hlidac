declare namespace Cloudflare {
  interface Env {
    OWNER_USER_ID?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SYNC_SECRET?: string;
    COLLECTOR_SECRET?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  }
}
