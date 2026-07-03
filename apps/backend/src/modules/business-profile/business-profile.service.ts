import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

// Mirror of packages/shared/src/constants/business.constants.ts — the backend
// ships no shared build step, so the seed/fallback is duplicated here (same
// pattern as PRICING_PLANS in provisioning.service.ts). This is the fallback
// used before the single BusinessProfile row is seeded; after that the DB row
// is authoritative.
export const BUSINESS_PROFILE_DEFAULT = {
  id: 'default',
  businessName: 'Varied Reach',
  tagline: 'Secure Virtual Data Room',
  legalName: 'Rohit Dubey',
  pan: 'CDJPR3842R',
  gstNumber: null as string | null,
  address: 'S Block 376, Panchsheel Park, New Delhi 110017',
  supportEmail: 'support@variedreach.com',
  supportPhone: '+91 88510 96461',
  website: 'vdr.variedreach.com',
};

export type BusinessProfileData = typeof BUSINESS_PROFILE_DEFAULT & { updatedAt?: Date };

@Injectable()
export class BusinessProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // Full profile (all fields) — used internally for invoices/emails and by the
  // Super Admin editor. Falls back to the constant when the row isn't seeded.
  async get(): Promise<BusinessProfileData> {
    const row = await this.prisma.businessProfile.findUnique({ where: { id: 'default' } });
    return row ?? BUSINESS_PROFILE_DEFAULT;
  }

  // Public subset — safe to expose unauthenticated (marketing footer/contact).
  // PAN and GST number are intentionally excluded.
  async getPublic() {
    const p = await this.get();
    return {
      businessName: p.businessName,
      tagline: p.tagline,
      supportEmail: p.supportEmail,
      supportPhone: p.supportPhone,
      website: p.website,
      address: p.address,
    };
  }

  async update(dto: UpdateBusinessProfileDto): Promise<BusinessProfileData> {
    const current = await this.get();
    const merged = {
      businessName: dto.businessName ?? current.businessName,
      tagline: dto.tagline ?? current.tagline,
      legalName: dto.legalName ?? current.legalName,
      pan: dto.pan ?? current.pan,
      gstNumber: dto.gstNumber !== undefined ? dto.gstNumber || null : current.gstNumber,
      address: dto.address ?? current.address,
      supportEmail: dto.supportEmail ?? current.supportEmail,
      supportPhone: dto.supportPhone ?? current.supportPhone,
      website: dto.website ?? current.website,
    };
    return this.prisma.businessProfile.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...merged },
      update: merged,
    });
  }
}
