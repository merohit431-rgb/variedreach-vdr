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

-- file_versions is append-only with ONE deliberate exception: FilesService's
-- getOrCreateConvertedPdf() caches an Office-document's converted PDF back
-- onto the version row's convertedPdfPath after first conversion, so later
-- previews reuse it instead of re-converting every time. A blanket
-- prevent_update_delete() here would make that UPDATE fail on every single
-- Office-file preview — confirmed as a real, live regression on staging
-- (this file previously bound file_versions to the generic function, which
-- silently overwrote a more permissive trigger already correctly running on
-- production). Every other column stays fully immutable; DELETE is never
-- allowed regardless of which column would change.
CREATE OR REPLACE FUNCTION prevent_file_version_tamper()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on table file_versions is not allowed — file_versions rows are append-only';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW."fileId" IS DISTINCT FROM OLD."fileId"
    OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
    OR NEW."storagePath" IS DISTINCT FROM OLD."storagePath"
    OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
    OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType"
    OR NEW.checksum IS DISTINCT FROM OLD.checksum
    OR NEW."uploadedBy" IS DISTINCT FROM OLD."uploadedBy"
    OR NEW.comment IS DISTINCT FROM OLD.comment
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'UPDATE on table file_versions is not allowed except to set convertedPdfPath — file_versions rows are append-only';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS file_versions_append_only ON file_versions;
CREATE TRIGGER file_versions_append_only
  BEFORE UPDATE OR DELETE ON file_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_file_version_tamper();
