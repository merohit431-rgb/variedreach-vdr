import type { Archiver as ArchiverInstance, ArchiverOptions } from 'archiver';
import { ArchiveService } from './archive.service';

// Same require()-based import files.service.ts already uses for this
// package -- archiver's own type declarations don't export a usable
// `create` function signature directly.
const createArchive = require('archiver') as (format: string, opts?: ArchiverOptions) => ArchiverInstance;

// Builds a real ZIP buffer in memory via the same `archiver` library this
// codebase already uses for bulk-download -- genuine zip bytes, not a hand-
// rolled fixture, so these tests exercise listZipEntries() against exactly
// the kind of archive a real upload would produce.
// A minimal, hand-built, single-entry ZIP (store method, no compression) --
// used ONLY for the path-traversal tests below, because `archiver` itself
// sanitizes a traversal-shaped name (confirmed directly: appending
// '../../../etc/passwd' is written to the real zip as plain 'etc/passwd').
// That's correct, protective behavior from archiver, but it means a
// fixture built through archiver can never contain the dangerous stored
// name this test needs to prove listZipEntries()'s OWN detection catches --
// a real malicious upload wouldn't be built with this codebase's own
// sanitizing library, so the fixture has to simulate that unsanitized input
// directly at the byte level instead.
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function buildRawZipWithRawName(rawName: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(rawName, 'utf-8');
  const crc = crc32(content);
  const localHeaderOffset = 0;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // method: stored (no compression)
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0x21, 12); // mod date
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(content.length, 18); // compressed size == uncompressed (stored)
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra field length

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // method
  centralHeader.writeUInt16LE(0, 12); // mod time
  centralHeader.writeUInt16LE(0x21, 14); // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(content.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // extra field length
  centralHeader.writeUInt16LE(0, 32); // comment length
  centralHeader.writeUInt16LE(0, 34); // disk number start
  centralHeader.writeUInt16LE(0, 36); // internal attrs
  centralHeader.writeUInt32LE(0, 38); // external attrs
  centralHeader.writeUInt32LE(localHeaderOffset, 42);

  const localSection = Buffer.concat([localHeader, nameBuf, content]);
  const centralSection = Buffer.concat([centralHeader, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16); // central directory offset

  return Buffer.concat([localSection, centralSection, eocd]);
}

async function buildZip(entries: Array<{ name: string; content: Buffer | string }>): Promise<Buffer> {
  const archive = createArchive('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  for (const entry of entries) {
    archive.append(entry.content, { name: entry.name });
  }
  await new Promise<void>((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
    archive.finalize();
  });
  return Buffer.concat(chunks);
}

describe('ArchiveService.listZipEntries', () => {
  const service = new ArchiveService();

  it('lists real entries with correct names and sizes, no flags on ordinary content', async () => {
    const zip = await buildZip([
      { name: 'readme.txt', content: 'hello world' },
      { name: 'folder/nested.txt', content: 'nested content here' },
    ]);

    const listing = await service.listZipEntries(zip);

    expect(listing.totalEntries).toBe(2);
    expect(listing.truncated).toBe(false);
    expect(listing.suspiciousTotalSize).toBe(false);
    const names = listing.entries.map((e) => e.name).sort();
    expect(names).toEqual(['folder/nested.txt', 'readme.txt']);
    expect(listing.entries.every((e) => !e.suspiciousPath && !e.suspiciouslyHighRatio && !e.isEncrypted)).toBe(true);
  });

  it('flags an entry with a path-traversal-shaped name without acting on it', async () => {
    // Built at the raw byte level deliberately -- archiver itself sanitizes
    // this exact name to 'etc/passwd' on write (confirmed directly), so a
    // fixture built through it could never carry the dangerous stored name
    // this test needs to prove listZipEntries()'s own detection catches.
    const zip = buildRawZipWithRawName('../../../etc/passwd', Buffer.from('not actually /etc/passwd'));

    const listing = await service.listZipEntries(zip);

    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0].name).toBe('../../../etc/passwd');
    expect(listing.entries[0].suspiciousPath).toBe(true);
  });

  it('flags an absolute-path-shaped entry name', async () => {
    const zip = buildRawZipWithRawName('/etc/passwd', Buffer.from('x'));
    const listing = await service.listZipEntries(zip);
    expect(listing.entries[0].suspiciousPath).toBe(true);
  });

  it('flags an entry with a suspiciously high compression ratio (zip-bomb signature)', async () => {
    // A long run of identical bytes compresses extremely well -- a genuine,
    // real way to produce a high real-world ratio without needing gigabytes
    // of actual data for the test itself.
    const highlyCompressible = Buffer.alloc(2 * 1024 * 1024, 0); // 2MB of zero bytes
    const zip = await buildZip([{ name: 'suspicious.bin', content: highlyCompressible }]);

    const listing = await service.listZipEntries(zip);

    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0].uncompressedSizeBytes).toBe(2 * 1024 * 1024);
    expect(listing.entries[0].suspiciouslyHighRatio).toBe(true);
  });

  it('does not flag ordinary, moderately-compressible text as suspicious', async () => {
    const ordinaryText = 'The quick brown fox jumps over the lazy dog. '.repeat(50);
    const zip = await buildZip([{ name: 'normal.txt', content: ordinaryText }]);

    const listing = await service.listZipEntries(zip);

    expect(listing.entries[0].suspiciouslyHighRatio).toBe(false);
  });

  it('truncates a listing with more entries than the configured maximum, flagging it rather than silently dropping the overflow', async () => {
    const manyEntries = Array.from({ length: 2005 }, (_, i) => ({ name: `file-${i}.txt`, content: 'x' }));
    const zip = await buildZip(manyEntries);

    const listing = await service.listZipEntries(zip);

    expect(listing.totalEntries).toBe(2005);
    expect(listing.entries).toHaveLength(2000);
    expect(listing.truncated).toBe(true);
  }, 30_000);

  it('rejects a buffer that is not actually a valid ZIP', async () => {
    const notAZip = Buffer.from('this is plainly not a zip file at all');
    await expect(service.listZipEntries(notAZip)).rejects.toThrow();
  });

  it('identifies a directory entry (trailing slash) without treating it as a suspiciously-ratio\'d file', async () => {
    const zip = await buildZip([{ name: 'empty-folder/', content: '' }]);
    const listing = await service.listZipEntries(zip);
    const dirEntry = listing.entries.find((e) => e.name === 'empty-folder/');
    expect(dirEntry?.isDirectory).toBe(true);
    expect(dirEntry?.suspiciouslyHighRatio).toBe(false);
  });
});
