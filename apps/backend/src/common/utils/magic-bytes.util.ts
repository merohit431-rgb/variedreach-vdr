/**
 * Magic byte (file signature) validation for all allowed upload types.
 *
 * Extension spoofing — renaming an .exe to .pdf — passes every name-based
 * check but fails here because the actual byte sequence at the start of the
 * file must match the declared type. Text-based formats (txt, csv, eml, msg)
 * have no reliable binary signature, so they pass through; their extension
 * whitelist is the primary control.
 */

interface Signature {
  bytes: number[];
  offset: number;
  extensions: string[];
}

const SIGNATURES: Signature[] = [
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, extensions: ['pdf'] },
  // ZIP-based Office (DOCX, XLSX, PPTX, ODT, ODS, ODP)
  { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0, extensions: ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'] },
  // OLE2 Compound Document (legacy DOC, XLS, PPT)
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    offset: 0,
    extensions: ['doc', 'xls', 'ppt'],
  },
  // JPEG
  { bytes: [0xff, 0xd8, 0xff], offset: 0, extensions: ['jpg', 'jpeg'] },
  // PNG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, extensions: ['png'] },
  // GIF (both 87a and 89a start with GIF8)
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, extensions: ['gif'] },
  // TIFF little-endian
  { bytes: [0x49, 0x49, 0x2a, 0x00], offset: 0, extensions: ['tiff', 'tif'] },
  // TIFF big-endian
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, extensions: ['tiff', 'tif'] },
  // RIFF container — WebP adds a 'WEBP' FourCC at offset 8 (checked separately)
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, extensions: ['webp'] },
];

// Text-based formats have no binary signature; extension whitelist is the sole gate.
const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'eml', 'msg']);

function matchesAt(buffer: Buffer, signature: number[], offset: number): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Validates that the file's actual bytes match its declared extension.
 *
 * Returns `{ valid: true }` when the signature matches or the format is
 * text-based (no magic bytes). Returns `{ valid: false, detectedType }` when
 * the bytes do not match any expected signature for the given extension.
 */
export function validateMagicBytes(
  buffer: Buffer,
  extension: string,
): { valid: boolean; expected?: string } {
  const ext = extension.toLowerCase().replace(/^\./, '');

  if (TEXT_EXTENSIONS.has(ext)) {
    return { valid: true };
  }

  // WebP: must start with RIFF and have 'WEBP' FourCC at bytes 8-11
  if (ext === 'webp') {
    const hasRiff = matchesAt(buffer, [0x52, 0x49, 0x46, 0x46], 0);
    const hasWebp = buffer.length >= 12 && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!hasRiff || !hasWebp) {
      return { valid: false, expected: 'WEBP (RIFF….WEBP)' };
    }
    return { valid: true };
  }

  for (const sig of SIGNATURES) {
    if (!sig.extensions.includes(ext)) continue;
    if (matchesAt(buffer, sig.bytes, sig.offset)) {
      return { valid: true };
    }
  }

  return { valid: false, expected: ext.toUpperCase() };
}
