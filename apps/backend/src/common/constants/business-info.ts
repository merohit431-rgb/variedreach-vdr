// Backend-side seller/brand constant — the seed/fallback for BusinessProfile
// and the brand used by static surfaces that can't do a DB read (email
// templates). Mirrors packages/shared BUSINESS_PROFILE. Financial documents
// (invoice PDF) read the LIVE BusinessProfile row instead, so an edit there
// is authoritative; this is only the default.
export const BUSINESS_INFO = {
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
