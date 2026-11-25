import { validateMagicBytes } from './magic-bytes.util';

const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
const NOT_ZIP = Buffer.from('this is plainly not a zip file at all');

// Phase 2 remediation: xlsm/xml/json were added to the upload allow-list.
// xlsm shares xlsx's ZIP-based OOXML signature; xml/json are plain text with
// no binary signature at all, same as the pre-existing txt/csv treatment.
describe('validateMagicBytes -- new formats', () => {
  it('accepts xlsm with a real ZIP signature', () => {
    expect(validateMagicBytes(ZIP_HEADER, 'xlsm')).toEqual({ valid: true });
  });

  it('rejects xlsm whose bytes are not actually a ZIP (extension spoofing)', () => {
    const result = validateMagicBytes(NOT_ZIP, 'xlsm');
    expect(result.valid).toBe(false);
  });

  it('accepts xml regardless of content -- text formats have no binary signature', () => {
    expect(validateMagicBytes(Buffer.from('<?xml version="1.0"?><root/>'), 'xml')).toEqual({ valid: true });
  });

  it('accepts json regardless of content -- text formats have no binary signature', () => {
    expect(validateMagicBytes(Buffer.from('{"a":1}'), 'json')).toEqual({ valid: true });
  });

  it('still rejects an unrelated extension with no matching signature (unchanged pre-existing behaviour)', () => {
    const result = validateMagicBytes(NOT_ZIP, 'pdf');
    expect(result.valid).toBe(false);
  });
});

// Phase 3D (client-confirmed file-format requirement): every new extension
// added to the allow-list gets its own real signature check here -- the
// same "extension spoofing fails validation" guarantee the pre-existing
// formats already have, not just a name-based allow-list entry.
describe('validateMagicBytes -- Phase 3D formats', () => {
  it('accepts tif with the same TIFF signature as tiff (the allow-list bug this phase fixes)', () => {
    const littleEndianTiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(littleEndianTiff, 'tif')).toEqual({ valid: true });
  });

  it('accepts a real BMP header ("BM")', () => {
    const bmp = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00]);
    expect(validateMagicBytes(bmp, 'bmp')).toEqual({ valid: true });
  });

  it('rejects bmp whose bytes are not actually a BMP', () => {
    expect(validateMagicBytes(NOT_ZIP, 'bmp').valid).toBe(false);
  });

  it('accepts xlsb with the same ZIP-based OOXML signature as xlsx/xlsm', () => {
    expect(validateMagicBytes(ZIP_HEADER, 'xlsb')).toEqual({ valid: true });
  });

  it('accepts a real ZIP upload', () => {
    expect(validateMagicBytes(ZIP_HEADER, 'zip')).toEqual({ valid: true });
  });

  it('rejects zip whose bytes are not actually a ZIP', () => {
    expect(validateMagicBytes(NOT_ZIP, 'zip').valid).toBe(false);
  });

  it('accepts a real 7z header', () => {
    const sevenZip = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]);
    expect(validateMagicBytes(sevenZip, '7z')).toEqual({ valid: true });
  });

  it('rejects 7z whose bytes are not actually a 7z archive', () => {
    expect(validateMagicBytes(NOT_ZIP, '7z').valid).toBe(false);
  });

  it('accepts a RAR 1.5-4.x header', () => {
    const rar4 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
    expect(validateMagicBytes(rar4, 'rar')).toEqual({ valid: true });
  });

  it('accepts a RAR 5.0+ header (a distinct, longer signature)', () => {
    const rar5 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]);
    expect(validateMagicBytes(rar5, 'rar')).toEqual({ valid: true });
  });

  it('rejects rar whose bytes are not actually a RAR archive', () => {
    expect(validateMagicBytes(NOT_ZIP, 'rar').valid).toBe(false);
  });

  it('accepts dxf regardless of content -- no reliable binary signature exists for ASCII DXF exports', () => {
    expect(validateMagicBytes(Buffer.from('0\nSECTION\n2\nHEADER\n'), 'dxf')).toEqual({ valid: true });
  });

  it('accepts a DWG with a modern "AC10xx" version tag', () => {
    const dwg = Buffer.from('AC1027' + '\0'.repeat(10));
    expect(validateMagicBytes(dwg, 'dwg')).toEqual({ valid: true });
  });

  it('rejects dwg whose bytes have no AC10 version tag (extension spoofing)', () => {
    expect(validateMagicBytes(NOT_ZIP, 'dwg').valid).toBe(false);
  });

  it('accepts the classic (pre-6.0) DWF binary header', () => {
    const classicDwf = Buffer.from('(DWF V00.55)');
    expect(validateMagicBytes(classicDwf, 'dwf')).toEqual({ valid: true });
  });

  it('accepts a modern ZIP-based (6.0+) DWF', () => {
    expect(validateMagicBytes(ZIP_HEADER, 'dwf')).toEqual({ valid: true });
  });

  it('rejects dwf matching neither the classic header nor a ZIP package', () => {
    expect(validateMagicBytes(NOT_ZIP, 'dwf').valid).toBe(false);
  });

  it('accepts a DWFX with the same ZIP/OPC-package signature as DWF 6.0+', () => {
    expect(validateMagicBytes(ZIP_HEADER, 'dwfx')).toEqual({ valid: true });
  });
});
