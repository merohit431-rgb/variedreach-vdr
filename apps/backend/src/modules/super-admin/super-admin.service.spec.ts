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
  subscriptionUpsert?: jest.Mock;
  fileAggregate?: jest.Mock;
  fileVersionAggregate?: jest.Mock;
  folderCount?: jest.Mock;
  dataRoomCount?: jest.Mock;
}) {
  const record = overrides.record ?? jest.fn().mockResolvedValue({});
  const update = overrides.update ?? jest.fn().mockResolvedValue({});
  const prisma = {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(overrides.organisation ?? null),
      findFirst: jest.fn().mockResolvedValue(null), // slug uniqueness check: nothing taken
      update,
    },
    subscription: {
      upsert: overrides.subscriptionUpsert ?? jest.fn().mockResolvedValue({ id: 'sub-1' }),
    },
    file: {
      aggregate: overrides.fileAggregate ?? jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0n }, _count: 0 }),
    },
    fileVersion: {
      aggregate: overrides.fileVersionAggregate ?? jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0n } }),
    },
    folder: { count: overrides.folderCount ?? jest.fn().mockResolvedValue(0) },
    dataRoom: { count: overrides.dataRoomCount ?? jest.fn().mockResolvedValue(0) },
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

describe('SuperAdminService.updateSubscription', () => {
  it('requires both dates when creating a subscription for an org that has none yet', async () => {
    const { service } = buildService({
      organisation: { id: 'org-1', planSlug: null, storageLimitGb: 12, subscription: null },
    });
    await expect(service.updateSubscription('org-1', { currentPeriodEnd: '2026-12-28' }, 'admin-1')).rejects.toThrow(
      'provide both currentPeriodStart and currentPeriodEnd',
    );
  });

  it('rejects a period end that is not after the period start', async () => {
    const { service } = buildService({
      organisation: { id: 'org-1', planSlug: null, storageLimitGb: 12, subscription: null },
    });
    await expect(
      service.updateSubscription(
        'org-1',
        { currentPeriodStart: '2026-12-28', currentPeriodEnd: '2026-06-28' },
        'admin-1',
      ),
    ).rejects.toThrow('currentPeriodStart must be before currentPeriodEnd');
  });

  it('creates ARCK-style subscription (6 months, no prior row) and logs creation, not a diff', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'sub-new' });
    const { service, record } = buildService({
      organisation: { id: 'org-1', planSlug: null, storageLimitGb: 12, subscription: null },
      subscriptionUpsert: upsert,
    });

    await service.updateSubscription(
      'org-1',
      { currentPeriodStart: '2026-06-28', currentPeriodEnd: '2026-12-28', status: 'ACTIVE' },
      'admin-1',
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org-1' },
        create: expect.objectContaining({
          organisationId: 'org-1',
          storageGb: 12,
          status: 'ACTIVE',
          currentPeriodStart: new Date('2026-06-28'),
          currentPeriodEnd: new Date('2026-12-28'),
        }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUBSCRIPTION_DATES_UPDATED',
        metadata: expect.objectContaining({ created: true }),
      }),
    );
  });

  it('extends an existing subscription and logs the old/new end date', async () => {
    const existingSub = {
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodStart: new Date('2026-06-28'),
      currentPeriodEnd: new Date('2026-12-28'),
    };
    const upsert = jest.fn().mockResolvedValue({ ...existingSub, currentPeriodEnd: new Date('2027-03-31') });
    const { service, record } = buildService({
      organisation: { id: 'org-1', planSlug: 'STARTER', storageLimitGb: 12, subscription: existingSub },
      subscriptionUpsert: upsert,
    });

    await service.updateSubscription('org-1', { currentPeriodEnd: '2027-03-31' }, 'admin-1');

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUBSCRIPTION_DATES_UPDATED',
        metadata: {
          currentPeriodEnd: { from: '2026-12-28T00:00:00.000Z', to: '2027-03-31' },
        },
      }),
    );
  });

  it('logs SUBSCRIPTION_REACTIVATED specifically when status transitions to ACTIVE', async () => {
    const existingSub = {
      id: 'sub-1',
      status: 'CANCELLED',
      currentPeriodStart: new Date('2026-06-28'),
      currentPeriodEnd: new Date('2026-12-28'),
    };
    const { service, record } = buildService({
      organisation: { id: 'org-1', planSlug: 'STARTER', storageLimitGb: 12, subscription: existingSub },
    });

    await service.updateSubscription('org-1', { status: 'ACTIVE' }, 'admin-1');

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUBSCRIPTION_REACTIVATED' }));
  });

  it('is a no-op (no audit entry) when nothing actually changed', async () => {
    const existingSub = {
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodStart: new Date('2026-06-28'),
      currentPeriodEnd: new Date('2026-12-28'),
    };
    const { service, record } = buildService({
      organisation: { id: 'org-1', planSlug: 'STARTER', storageLimitGb: 12, subscription: existingSub },
    });

    await service.updateSubscription('org-1', { status: 'ACTIVE' }, 'admin-1');

    expect(record).not.toHaveBeenCalled();
  });
});

describe('SuperAdminService.getOrganisationStorageDetail', () => {
  it('404s for a non-existent organisation', async () => {
    const { service } = buildService({ organisation: null });
    await expect(service.getOrganisationStorageDetail('missing')).rejects.toThrow('Organisation not found');
  });

  it('derives priorVersions as total-version bytes minus live+trash, never negative', async () => {
    // live: 2 current files totalling 5GB; trash: 1 deleted file, 1GB;
    // allVersions: every version ever stored for this org's files, 9GB --
    // the 3GB difference is bytes belonging to superseded versions, with no
    // other representation anywhere in the app today.
    const fileAggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { sizeBytes: 5_000_000_000n }, _count: 2 }) // live
      .mockResolvedValueOnce({ _sum: { sizeBytes: 1_000_000_000n }, _count: 1 }); // trash
    const { service } = buildService({
      organisation: { id: 'org-1', storageLimitGb: 12 },
      fileAggregate,
      fileVersionAggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 9_000_000_000n } }),
      folderCount: jest.fn().mockResolvedValue(14),
      dataRoomCount: jest.fn().mockResolvedValue(3),
    });

    const result = await service.getOrganisationStorageDetail('org-1');

    expect(result.breakdown.live).toEqual({ bytes: '5000000000', fileCount: 2 });
    expect(result.breakdown.trash).toEqual({ bytes: '1000000000', fileCount: 1 });
    expect(result.breakdown.priorVersions).toEqual({ bytes: '3000000000' });
    expect(result.counts).toEqual({ folders: 14, dataRooms: 3 });
  });

  it('never reports negative priorVersions when live+trash already accounts for everything', async () => {
    const fileAggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { sizeBytes: 5_000_000_000n }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { sizeBytes: 0n }, _count: 0 });
    const { service } = buildService({
      organisation: { id: 'org-1', storageLimitGb: 12 },
      fileAggregate,
      // No versioning has ever happened -- allVersions equals exactly the
      // current versions' bytes (each file has exactly one version).
      fileVersionAggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 5_000_000_000n } }),
    });

    const result = await service.getOrganisationStorageDetail('org-1');

    expect(result.breakdown.priorVersions).toEqual({ bytes: '0' });
  });
});
