// Single source of truth for the seller / business identity shown across the
// app, emails, and invoices. This is the SEED/FALLBACK — the live values are
// stored in the BusinessProfile table (editable from Super Admin), and the
// backend BusinessProfileService returns the row when present, this constant
// otherwise. When GST registration is obtained, the gstNumber is set once in
// Super Admin and flows everywhere; nothing here needs a code change.

export interface BusinessProfile {
  businessName: string;
  tagline: string;
  legalName: string;
  pan: string;
  gstNumber: string | null;
  address: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
}

export const BUSINESS_PROFILE: BusinessProfile = {
  businessName: 'Varied Reach',
  tagline: 'Secure Virtual Data Room',
  legalName: 'Rohit Dubey',
  pan: 'CDJPR3842R',
  gstNumber: null, // not registered under GST yet — set here when obtained
  address: 'S Block 376, Panchsheel Park, New Delhi 110017',
  supportEmail: 'support@variedreach.com',
  supportPhone: '+91 88510 96461',
  website: 'vdr.variedreach.com',
};

// The public tagline shown under the wordmark everywhere the logo appears.
export const BUSINESS_TAGLINE = BUSINESS_PROFILE.tagline;
