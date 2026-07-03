'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { BUSINESS_PROFILE } from '@variedreach-vdr/shared';

export interface PublicBusinessProfile {
  businessName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  address: string;
}

// The compile-time constant is the instant fallback (equals the DB seed), so
// the UI never flashes empty and works with no network. The live row from
// GET /business-profile then takes over, so a Super-Admin edit flows here
// without a redeploy. Provider-independent (plain fetch, no React Query) so it
// works on marketing pages too.
const FALLBACK: PublicBusinessProfile = {
  businessName: BUSINESS_PROFILE.businessName,
  tagline: BUSINESS_PROFILE.tagline,
  supportEmail: BUSINESS_PROFILE.supportEmail,
  supportPhone: BUSINESS_PROFILE.supportPhone,
  website: BUSINESS_PROFILE.website,
  address: BUSINESS_PROFILE.address,
};

export function useBusinessProfile(): PublicBusinessProfile {
  const [profile, setProfile] = useState<PublicBusinessProfile>(FALLBACK);

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ data: PublicBusinessProfile }>('/business-profile')
      .then((res) => {
        if (active && res.data?.data) setProfile(res.data.data);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return profile;
}
