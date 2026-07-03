'use client';

import { Mail, Phone, MapPin } from 'lucide-react';
import { useBusinessProfile } from '@/hooks/use-business-profile';

// Contact block for the marketing footer — reads the live Business Profile so
// a Super-Admin edit updates it everywhere without a redeploy (constant seed
// as instant fallback).
export function FooterContact() {
  const profile = useBusinessProfile();
  const telHref = `tel:${profile.supportPhone.replace(/[^0-9+]/g, '')}`;

  return (
    <div className="mt-6 flex flex-col gap-2.5 text-sm text-slate-400">
      <a
        href={`mailto:${profile.supportEmail}`}
        className="flex items-center gap-2 transition-colors hover:text-slate-200"
      >
        <Mail className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
        {profile.supportEmail}
      </a>
      <a href={telHref} className="flex items-center gap-2 transition-colors hover:text-slate-200">
        <Phone className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
        {profile.supportPhone}
      </a>
      <span className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
        {profile.address}
      </span>
    </div>
  );
}
