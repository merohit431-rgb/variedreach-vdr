-- Runs once on first container start (docker-entrypoint-initdb.d).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Append-only enforcement for evidentiary/audit-integrity tables: once a row
-- exists, it must never be edited or removed. These are the records that
-- prove who did what and when in an insolvency VDR, so they're only as
-- trustworthy as how tamper-resistant they are. Functions use CREATE OR
-- REPLACE and triggers are dropped/recreated, so this file is also safe to
-- re-run by hand against an already-initialized database (this block
-- previously existed only as undocumented manual SQL applied directly to
-- production — see DEPLOYMENT.md for how to bring an existing environment
-- in sync).
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% on table % is not allowed — % rows are append-only', TG_OP, TG_TABLE_NAME, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE DELETE OR UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

DROP TRIGGER IF EXISTS watermarks_append_only ON watermarks;
CREATE TRIGGER watermarks_append_only
  BEFORE DELETE OR UPDATE ON watermarks
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- file_versions needs one narrow, deliberate exception. getOrCreateConvertedPdf()
-- (apps/backend/src/modules/files/files.service.ts) caches the one-time
-- Office-doc -> PDF conversion by writing convertedPdfPath onto the existing
-- version row the first time it's previewed, instead of re-running Gotenberg
-- on every single preview. That's a derived cache artifact, not part of the
-- evidentiary record -- every other column (checksum, storagePath,
-- sizeBytes, etc.) stays fully append-only, exactly as before. A blanket
-- prevent_update_delete() here blocked this legitimate cache write outright:
-- this trigger existed on production but not staging, so Office document
-- preview had been silently broken in production (500 error) since whenever
-- it was added by hand, with nothing to catch it on staging.
CREATE OR REPLACE FUNCTION prevent_file_version_tamper()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS file_versions_append_only ON file_versions;
CREATE TRIGGER file_versions_append_only
  BEFORE DELETE OR UPDATE ON file_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_file_version_tamper();
