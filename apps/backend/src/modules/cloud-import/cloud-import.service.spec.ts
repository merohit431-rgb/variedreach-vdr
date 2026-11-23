import { BadRequestException } from '@nestjs/common';
import { CloudImportService } from './cloud-import.service';
import type { FilesService } from '../files/files.service';
import type { DataRoomAccessService } from '../data-room-access/data-room-access.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

const ACTOR = { id: 'user-1', organisationId: 'org-1', role: 'RP_LIQUIDATOR' } as AuthenticatedUser;

function buildService(opts: { assertContentManager?: jest.Mock; upload?: jest.Mock } = {}) {
  const assertContentManager = opts.assertContentManager ?? jest.fn().mockResolvedValue({ effectiveRole: 'RP_LIQUIDATOR' });
  const upload = opts.upload ?? jest.fn().mockResolvedValue([{ id: 'file-1' }]);
  const service = new CloudImportService(
    { upload } as unknown as FilesService,
    { assertContentManager } as unknown as DataRoomAccessService,
  );
  return { service, assertContentManager, upload };
}

// Phase 4 security finding: dto.downloadUrl was fetched with zero host
// validation at all -- a client could point it at an internal service or a
// cloud metadata endpoint (e.g. http://169.254.169.254/...), and the fetched
// response body would be streamed straight into the Data Room as a "file".
// These tests prove the fix: malicious URLs are rejected BEFORE any network
// call is made (global.fetch must never be invoked for them), while a
// genuinely well-formed Microsoft download URL is still accepted.
describe('CloudImportService.importOneDriveFile -- SSRF hostname allowlist (Phase 4)', () => {
  const originalFetch = global.fetch;
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const baseDto = { name: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 1000 };

  it.each([
    ['an internal/link-local IP (cloud metadata endpoint)', 'http://169.254.169.254/latest/meta-data/'],
    ['localhost', 'http://localhost:6379/'],
    ['a private-network host', 'http://10.0.0.5/internal-api'],
    ['an attacker-controlled domain', 'https://evil.example.com/payload'],
    ['a domain that merely CONTAINS "sharepoint.com" as a substring, not a real subdomain', 'https://sharepoint.com.evil.example.com/x'],
    ['http instead of https on an otherwise-real-looking host', 'http://contoso.sharepoint.com/file'],
    ['a non-http(s) scheme', 'file:///etc/passwd'],
    ['a malformed URL', 'not-a-url-at-all'],
  ])('rejects %s without ever calling fetch', async (_label, maliciousUrl) => {
    const { service, upload } = buildService();

    await expect(
      service.importOneDriveFile('room-1', { ...baseDto, downloadUrl: maliciousUrl }, ACTOR),
    ).rejects.toThrow(BadRequestException);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('accepts a genuinely well-formed Microsoft OneDrive/SharePoint download URL and proceeds to fetch it', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    });
    const { service, upload } = buildService();

    await service.importOneDriveFile('room-1', { ...baseDto, downloadUrl: 'https://contoso.sharepoint.com/_layouts/download.aspx?x=1' }, ACTOR);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toBe('https://contoso.sharepoint.com/_layouts/download.aspx?x=1');
    expect(calledOpts).toEqual(expect.objectContaining({ redirect: 'error' }));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('rejects the folder-URL look-alike "sharepointonline.com.attacker.com"', async () => {
    const { service } = buildService();
    await expect(
      service.importOneDriveFile('room-1', { ...baseDto, downloadUrl: 'https://contoso.sharepointonline.com.attacker.com/x' }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  it('still enforces room-level authorisation before even looking at the URL', async () => {
    const assertContentManager = jest.fn().mockRejectedValue(new Error('not a manager'));
    const { service } = buildService({ assertContentManager });

    await expect(
      service.importOneDriveFile('room-1', { ...baseDto, downloadUrl: 'https://contoso.sharepoint.com/x' }, ACTOR),
    ).rejects.toThrow('not a manager');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('turns a redirect response into a clean, safe error rather than following it', async () => {
    // fetch's own redirect:'error' mode throws a TypeError when the server
    // responds with a redirect -- simulated here directly.
    fetchSpy.mockRejectedValue(new TypeError('unexpected redirect'));
    const { service } = buildService();

    await expect(
      service.importOneDriveFile('room-1', { ...baseDto, downloadUrl: 'https://contoso.sharepoint.com/x' }, ACTOR),
    ).rejects.toThrow('Could not download');
  });
});
