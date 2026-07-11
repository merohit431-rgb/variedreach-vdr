import { Transform } from 'class-transformer';

// Postgres `=` comparison is case-sensitive, so two code paths writing/reading
// the same address with different casing look like different identities to
// the DB -- this caused two real production login-lockout incidents (one
// invited email stored as "Sudeep.*", one batch of five stored via a manual
// script that skipped DTO validation entirely). Every touch of User.email --
// create, update, or lookup -- must go through this one function so there is
// exactly one place that defines "normalized".
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// DTO-layer equivalent of normalizeEmail(), for any @IsEmail() field. Keeps
// every DTO's transform identical instead of each one re-implementing the
// same trim+lowercase lambda (and risking one being subtly different).
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value));
}
