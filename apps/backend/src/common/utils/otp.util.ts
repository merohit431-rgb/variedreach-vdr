import { randomInt } from 'crypto';

// crypto.randomInt is cryptographically strong, unlike Math.random — this
// code gates account access, so it needs the same rigor as a token.
export function generateNumericOtp(length = 6): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}
