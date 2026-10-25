-- Opt in to least-privilege defaults for future public-schema objects.
-- The backend service role keeps its platform default access; browser-facing
-- roles receive privileges only when a migration grants them explicitly.
alter default privileges for role postgres in schema public
 revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
 revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
 revoke execute on functions from anon, authenticated;
