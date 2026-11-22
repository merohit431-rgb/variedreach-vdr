import { PdfEncryptedError, PdfExtractionAdapter, PdfTooLargeError, PdfUnreadableError } from './pdf-extraction.adapter';

// pdfjs-dist is a true ESM-only package (confirmed necessary via the Phase
// 3B spike, see scripts/verify-pdf-extraction.js) -- its dynamic import
// cannot execute inside Jest's CommonJS test environment without invasive,
// shared-config changes that would risk every other test in this suite.
// These tests mock the library to verify THIS ADAPTER's own orchestration
// logic (error classification, page-limit enforcement, per-page failure
// isolation, scanned-page detection) deterministically; the real library's
// extraction accuracy and encrypted-PDF detection were independently
// verified against real PDF fixtures via scripts/verify-pdf-extraction.js,
// run under plain Node, outside Jest, where the real dynamic import works
// exactly as pdfjs-dist documents.
const mockGetDocument = jest.fn();
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument: mockGetDocument }), { virtual: true });

function mockDoc(numPages: number, pages: Array<{ str: string } | 'throw'>) {
  return {
    numPages,
    getPage: jest.fn((pageNumber: number) => {
      const page = pages[pageNumber - 1];
      if (page === 'throw') throw new Error('corrupt page content stream');
      return Promise.resolve({ getTextContent: () => Promise.resolve({ items: [{ str: page.str }] }) });
    }),
  };
}

describe('PdfExtractionAdapter', () => {
  const adapter = new PdfExtractionAdapter();

  beforeEach(() => {
    mockGetDocument.mockReset();
  });

  it('extracts page text and preserves page numbers/boundaries', async () => {
    const page1Text = 'This is the first page of a real-looking document with substantive content.';
    const page2Text = 'This is the second page, also with enough text to not look scanned.';
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc(2, [{ str: page1Text }, { str: page2Text }])),
    });

    const pages = await adapter.extractPages(Buffer.from('fake'), 500);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ pageNumber: 1, text: page1Text, isScannedOrImageOnly: false });
    expect(pages[1]).toMatchObject({ pageNumber: 2, text: page2Text, isScannedOrImageOnly: false });
  });

  it('maps a PasswordException to PdfEncryptedError, never fabricating content', async () => {
    const err = new Error('No password given');
    err.name = 'PasswordException';
    mockGetDocument.mockReturnValue({ promise: Promise.reject(err) });

    await expect(adapter.extractPages(Buffer.from('fake'), 500)).rejects.toThrow(PdfEncryptedError);
  });

  it('maps any other load failure to PdfUnreadableError, not a raw crash', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('invalid xref table')) });

    await expect(adapter.extractPages(Buffer.from('fake'), 500)).rejects.toThrow(PdfUnreadableError);
  });

  it('rejects a document exceeding the configured max page count before extracting any page text', async () => {
    const doc = mockDoc(5, []);
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(doc) });

    await expect(adapter.extractPages(Buffer.from('fake'), 3)).rejects.toThrow(PdfTooLargeError);
    expect(doc.getPage).not.toHaveBeenCalled();
  });

  it('marks a page with no extractable text as scanned/image-only, never inventing content for it', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockDoc(1, [{ str: '' }])) });

    const pages = await adapter.extractPages(Buffer.from('fake'), 500);

    expect(pages[0].isScannedOrImageOnly).toBe(true);
    expect(pages[0].text).toBe('');
  });

  it('isolates a single bad page -- one page throwing never fails the whole document', async () => {
    const page2Text = 'The second page extracted fine and has plenty of substantive content.';
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc(2, ['throw', { str: page2Text }])),
    });

    const pages = await adapter.extractPages(Buffer.from('fake'), 500);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ pageNumber: 1, text: '', isScannedOrImageOnly: true });
    expect(pages[1]).toMatchObject({ pageNumber: 2, text: page2Text, isScannedOrImageOnly: false });
  });
});
