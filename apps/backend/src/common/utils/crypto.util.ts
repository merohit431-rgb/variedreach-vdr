import { randomBytes, createHash } from 'crypto';

// Raw token goes in the emailed URL / client cookie; only the hash is ever persisted.
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: sha256Hex(raw) };
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function stableChecksum(payload: Record<string, unknown>): string {
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return sha256Hex(JSON.stringify(ordered));
}
