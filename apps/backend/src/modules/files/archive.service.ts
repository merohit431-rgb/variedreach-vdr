import { Injectable } from '@nestjs/common';
import * as yauzl from 'yauzl';

// Phase 3D (client-confirmed requirement): "ZIP/7Z/RAR: File metadata and
// archive listing only where safely supported." ZIP is the only one of the
// three with a reliable, well-vetted pure-JS way to read structure without
// decompressing content -- 7Z/RAR have no equivalent safe library, so they
// are upload/download/validate-only (see file-type-rules.ts), never listed.
//
// Safety model: this NEVER calls ZipFile.openReadStream() on any entry --
// only the central directory's own metadata (name, declared sizes, CRC) is
// ever read. A zip bomb's danger is specifically the act of decompressing;
// reading declared sizes as plain integers from the central directory
// carries none of that risk regardless of how extreme those declared
// numbers are, which is also why a suspicious-ratio entry is flagged for a
// human to see rather than something this service needs to defend against
// by refusing to decompress it -- it was never going to decompress anything.
export interface ArchiveEntryInfo {
  name: string;
  isDirectory: boolean;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  isEncrypted: boolean;
  // A central-directory entry name containing '../', a leading '/', a
  // Windows-style '..\', or a null byte -- surfaced for visibility, not
  // acted on. There is no extraction path in this product (listing only),
  // so nothing is ever written to a traversed location; if extraction is
  // ever added later, sanitizing/refusing these at write time becomes
  // mandatory, not optional.
  suspiciousPath: boolean;
  // uncompressedSizeBytes / compressedSizeBytes, rounded -- a classic
  // zip-bomb indicator (a handful of KB expanding to GB+) when very high,
  // flagged for human review at a conservative threshold rather than
  // silently hidden or used to refuse the listing.
  suspiciouslyHighRatio: boolean;
}

export interface ArchiveListing {
  entries: ArchiveEntryInfo[];
  totalEntries: number;
  truncated: boolean;
  suspiciousTotalSize: boolean;
}

// A listing this large is itself a DoS surface independent of any single
// entry's ratio (millions of tiny central-directory records are cheap for
// an attacker to construct, expensive for a server to enumerate/serialize).
const MAX_ENTRIES = 2000;
// Beyond this ratio for a single entry, flag it -- ordinary compressible
// content (text, uncompressed media re-zipped) essentially never exceeds
// double digits; triple digits are the known zip-bomb signature (e.g. the
// classic 42.zip reaches ratios in the billions).
const SUSPICIOUS_RATIO_THRESHOLD = 100;
// A sanity ceiling on the archive's own total DECLARED uncompressed size
// (summed from metadata only, never actually allocated or decompressed) --
// flags the listing as a whole when the declared total is wildly out of
// proportion to a real document archive.
const SUSPICIOUS_TOTAL_UNCOMPRESSED_BYTES = 50 * 1024 * 1024 * 1024; // 50GB

function hasSuspiciousPath(name: string): boolean {
  return name.includes('../') || name.includes('..\\') || name.startsWith('/') || name.includes('\0');
}

@Injectable()
export class ArchiveService {
  async listZipEntries(buffer: Buffer): Promise<ArchiveListing> {
    // decodeStrings: false is deliberate, not a missed default. With it left
    // true (yauzl's own default), yauzl's OWN validateFileName() hard-
    // rejects any traversal- or absolute-path-shaped entry name by emitting
    // an 'error' that aborts the ENTIRE read -- confirmed directly: a single
    // malicious entry in an otherwise-ordinary archive would crash this
    // whole listing instead of being flagged. Decoding the raw filename
    // bytes ourselves (below) keeps that detection as a per-entry
    // suspiciousPath flag the caller can see, without ever handing a
    // dangerous name to any filesystem API -- there is no extraction path
    // in this feature for such a name to act on in the first place.
    const zipfile = await yauzl.fromBufferPromise(buffer, { lazyEntries: true, decodeStrings: false });

    try {
      const entries: ArchiveEntryInfo[] = [];
      let totalEntries = 0;
      let truncated = false;
      let totalUncompressed = 0;

      await new Promise<void>((resolve, reject) => {
        zipfile.on('error', reject);
        zipfile.on('end', resolve);
        zipfile.on('entry', (entry: yauzl.Entry) => {
          const fileName = (entry.fileName as unknown as Buffer).toString('utf-8');
          totalEntries += 1;
          totalUncompressed += entry.uncompressedSize;

          if (entries.length < MAX_ENTRIES) {
            const isDirectory = fileName.endsWith('/');
            const ratio = entry.compressedSize > 0 ? entry.uncompressedSize / entry.compressedSize : 0;
            entries.push({
              name: fileName,
              isDirectory,
              compressedSizeBytes: entry.compressedSize,
              uncompressedSizeBytes: entry.uncompressedSize,
              isEncrypted: entry.isEncrypted(),
              suspiciousPath: hasSuspiciousPath(fileName),
              suspiciouslyHighRatio: !isDirectory && ratio > SUSPICIOUS_RATIO_THRESHOLD,
            });
          } else {
            truncated = true;
          }

          zipfile.readEntry();
        });
        zipfile.readEntry();
      });

      return {
        entries,
        totalEntries,
        truncated,
        suspiciousTotalSize: totalUncompressed > SUSPICIOUS_TOTAL_UNCOMPRESSED_BYTES,
      };
    } finally {
      zipfile.close();
    }
  }
}
