-- Enforces lowercase-only emails at the database level for the users table.
-- The application always normalizes email (trim + lowercase) before writing
-- via normalizeEmail()/@NormalizeEmail() (see common/utils/email.util.ts) --
-- this constraint means that holds even against a manual psql session, an
-- ad-hoc onboarding script, or a future code path that forgets to normalize.
-- That exact gap (a script writing User.email directly, bypassing the app)
-- caused two real production login-lockout incidents.
--
-- Idempotent: safe to re-run (e.g. after `prisma migrate reset`). Not part of
-- Prisma's migration history because check constraints aren't representable
-- in schema.prisma on this Prisma version -- run via `npm run
-- prisma:email-check` after migrating/pushing. See README for when to run
-- this.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_lowercase_check;
ALTER TABLE users ADD CONSTRAINT users_email_lowercase_check CHECK (email = LOWER(email));
