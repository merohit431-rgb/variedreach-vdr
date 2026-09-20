import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { IPaymentProvider } from '../payment/payment-provider.interface';
import type { RazorpayPaymentProvider } from '../payment/providers/razorpay-payment.provider';

function buildService(overrides: {
  organisation?: unknown;
  update?: jest.Mock;
  record?: jest.Mock;
}) {
  const record = overrides.record ?? jest.fn().mockResolvedValue({});
  const update = overrides.update ?? jest.fn().mockResolvedValue({});
  const prisma = {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(overrides.organisation ?? null),
      findFirst: jest.fn().mockResolvedValue(null), // slug uniqueness check: nothing taken
      update,
    },
  } as unknown as PrismaService;
  const auditLogService = { record } as unknown as AuditLogService;
  const service = new SuperAdminService(
    prisma,
    auditLogService,
    {} as IPaymentProvider,
    {} as RazorpayPaymentProvider,
  );
  return { service, prisma, record, update };
}

describe('SuperAdminService.archiveOrganisation', () => {
  it('rejects when the typed name does not match', async () => {
    const { service } = buildService({
      organisation: { id: 'org-1', name: 'ARCK Resolution Professionals LLP', deletedAt: null },
    });
    await expect(service.archiveOrganisation('org-1', 'ARCK', 'admin-1')).rejects.toThrow(
      'Organisation name confirmation does not match',
    );
  });

  it('rejects archiving an already-archived organisation', async () => {
    const { service } = buildService({
      organisation: { id: 'org-1', name: 'Agilent', deletedAt: new Date() },
    });
    await expect(service.archiveOrganisation('org-1', 'Agilent', 'admin-1')).rejects.toThrow(
      'This organisation is already archived',
    );
  });

  it('archives on an exact name match, sets deletedAt + SUSPENDED, and audit-logs ORGANISATION_DELETED', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { service, record } = buildService({
      organisation: { id: 'org-1', name: 'Agilent', deletedAt: null },
      update,
    });

    const result = await service.archiveOrganisation('org-1', 'Agilent', 'admin-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { deletedAt: expect.any(Date), status: 'SUSPENDED' },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORGANISATION_DELETED', userId: 'admin-1', resourceId: 'org-1' }),
    );
    expect(result).toEqual({ archived: true });
  });
});

describe('SuperAdminService.setOrganisationStatus', () => {
  it('404s for a non-existent organisation', async () => {
    const { service } = buildService({ organisation: null });
    await expect(service.setOrganisationStatus('missing', 'SUSPENDED', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('blocks changing status on an archived organisation', async () => {
    const { service } = buildService({
      organisation: { id: 'org-1', status: 'ACTIVE', deletedAt: new Date() },
    });
    await expect(service.setOrganisationStatus('org-1', 'SUSPENDED', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('is a no-op (no write, no audit entry) when the status already matches', async () => {
    const { service, update, record } = buildService({
      organisation: { id: 'org-1', status: 'SUSPENDED', deletedAt: null },
    });
    await service.setOrganisationStatus('org-1', 'SUSPENDED', 'admin-1');
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('deactivates and logs ORGANISATION_DEACTIVATED', async () => {
    const { service, record } = buildService({
      organisation: { id: 'org-1', status: 'ACTIVE', deletedAt: null },
    });
    await service.setOrganisationStatus('org-1', 'SUSPENDED', 'admin-1');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORGANISATION_DEACTIVATED' }));
  });

  it('reactivates and logs ORGANISATION_ACTIVATED', async () => {
    const { service, record } = buildService({
      organisation: { id: 'org-1', status: 'SUSPENDED', deletedAt: null },
    });
    await service.setOrganisationStatus('org-1', 'ACTIVE', 'admin-1');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORGANISATION_ACTIVATED' }));
  });
});

describe('SuperAdminService.updateOrganisation rename', () => {
  it('regenerates the slug and logs ORGANISATION_RENAMED when name changes', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { service, record } = buildService({
      organisation: { id: 'org-1', name: 'Demo Resolution Professionals LLP', slug: 'demo-rp', userLimit: 10, storageLimitGb: 12, planSlug: null },
      update,
    });

    await service.updateOrganisation('org-1', { name: 'ARCK Resolution Professionals LLP' }, 'admin-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { name: 'ARCK Resolution Professionals LLP', slug: 'arck-resolution-professionals-llp' },
      include: expect.anything(),
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORGANISATION_RENAMED',
        metadata: { from: 'Demo Resolution Professionals LLP', to: 'ARCK Resolution Professionals LLP' },
      }),
    );
  });

  it('does not touch the slug or log a rename when name is unchanged', async () => {
    const update = jest.fn().mockResolvedValue({});
    const { service, record } = buildService({
      organisation: { id: 'org-1', name: 'Agilent', slug: 'agilent', userLimit: 5, storageLimitGb: 5, planSlug: null },
      update,
    });

    await service.updateOrganisation('org-1', { userLimit: 20 }, 'admin-1');

    expect(update.mock.calls[0][0].data).not.toHaveProperty('slug');
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'ORGANISATION_RENAMED' }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORGANISATION_UPDATED' }));
  });
});
