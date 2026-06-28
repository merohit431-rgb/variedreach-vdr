-- Enforces append-only at the database level for the three tables that are
-- immutable by design (no updatedAt/deletedAt in schema.prisma): audit_logs,
-- watermarks, file_versions. The application never updates or deletes rows
-- in these tables — this trigger means that stays true even against a
-- compromised application server, a manual psql session, or a future bug.
--
-- Idempotent: safe to re-run (e.g. after `prisma migrate reset`). Not part of
-- Prisma's migration history because triggers aren't representable in
-- schema.prisma — run via `npm run prisma:triggers` after migrating. See
-- README for when to run this.

CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% on table % is not allowed — % rows are append-only', TG_OP, TG_TABLE_NAME, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS watermarks_append_only ON watermarks;
CREATE TRIGGER watermarks_append_only
  BEFORE UPDATE OR DELETE ON watermarks
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS file_versions_append_only ON file_versions;
CREATE TRIGGER file_versions_append_only
  BEFORE UPDATE OR DELETE ON file_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
