/**
 * Magic byte (file signature) validation for all allowed upload types.
 *
 * Extension spoofing — renaming an .exe to .pdf — passes every name-based
 * check but fails here because the actual byte sequence at the start of the
 * file must match the declared type. Text-based formats (txt, csv, eml, msg,
 * xml, json, dxf) have no reliable binary signature, so they pass through;
 * their extension whitelist is the primary control.
 */

interface Signature {
  bytes: number[];
  offset: number;
  extensions: string[];
}

const SIGNATURES: Signature[] = [
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, extensions: ['pdf'] },
  // ZIP-based OOXML/OpenDocument/archive container. DOCX/XLSX/XLSM/PPTX/
  // ODT/ODS/ODP are all ZIP packages internally; XLSB is the same ZIP-based
  // OOXML package too (binary-encoded sheet data inside, not a legacy OLE2
  // binary like XLS); DWFX is Autodesk's newer DWF variant, also a ZIP/OPC
  // package; and a plain ZIP upload is, by definition, exactly this
  // signature with no further structure implied.
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
    extensions: ['docx', 'xlsx', 'xlsm', 'xlsb', 'pptx', 'odt', 'ods', 'odp', 'dwfx', 'zip'],
  },
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
  // BMP ("BM" header)
  { bytes: [0x42, 0x4d], offset: 0, extensions: ['bmp'] },
  // TIFF little-endian
  { bytes: [0x49, 0x49, 0x2a, 0x00], offset: 0, extensions: ['tiff', 'tif'] },
  // TIFF big-endian
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, extensions: ['tiff', 'tif'] },
  // RIFF container — WebP adds a 'WEBP' FourCC at offset 8 (checked separately)
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, extensions: ['webp'] },
  // 7-Zip
  { bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], offset: 0, extensions: ['7z'] },
  // RAR 1.5–4.x
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00], offset: 0, extensions: ['rar'] },
  // RAR 5.0+ (a distinct signature, one byte longer -- not a prefix of the
  // one above, so this needs its own entry rather than a shorter shared one)
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00], offset: 0, extensions: ['rar'] },
];

// Text-based formats have no binary signature; extension whitelist is the
// sole gate. DXF (the real CAD interchange format behind the client's
// requested "DFX") is included here deliberately, not an oversight: the
// common ASCII-DXF export is plain text with no fixed magic-byte preamble
// (it begins with ordinary section-marker text that varies by exporting
// application), so there is no reliable signature to check against --
// exactly the same honest limitation as txt/csv/xml/json, not a weaker
// standard invented just for this format.
const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'eml', 'msg', 'xml', 'json', 'dxf']);

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

  // DWG: every real-world AutoCAD drawing from the last ~25 years (AutoCAD
  // 2000 through current releases) starts with the ASCII version tag
  // "AC10" followed by two more version digits (e.g. AC1015, AC1021,
  // AC1032) -- a loosely-documented, versioned format with no single public
  // spec, so this is a best-effort, not exhaustive, check: it accepts the
  // common modern version family and does not attempt to enumerate every
  // historical pre-2000 tag (AC1001..AC1009), which is vanishingly unlikely
  // in current enterprise use.
  if (ext === 'dwg') {
    const tag = buffer.subarray(0, 4).toString('ascii');
    if (tag !== 'AC10') {
      return { valid: false, expected: 'DWG (AC10xx version tag)' };
    }
    return { valid: true };
  }

  // DWF has two genuinely different sub-formats in real-world use: the
  // classic (pre-6.0) "Drawing Web Format", a binary structure starting
  // with the literal ASCII text "(DWF", and the modern (6.0+) DWF, which is
  // actually the same ZIP/OPC package family as DWFX. Accepting either
  // reflects real format ambiguity, not a weaker check -- a file matching
  // neither is not a DWF under any version of the format.
  if (ext === 'dwf') {
    const isClassicDwf = buffer.subarray(0, 4).toString('ascii') === '(DWF';
    const isZipBasedDwf = matchesAt(buffer, [0x50, 0x4b, 0x03, 0x04], 0);
    if (!isClassicDwf && !isZipBasedDwf) {
      return { valid: false, expected: 'DWF (classic "(DWF" header or ZIP-based 6.0+ package)' };
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
