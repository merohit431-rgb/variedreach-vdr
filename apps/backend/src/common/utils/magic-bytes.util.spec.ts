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
