import { Mail, Phone, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

const CONTACT_DETAILS = [
  { icon: Mail, label: 'Email', value: 'rohit@variedreach.com', href: 'mailto:rohit@variedreach.com' },
  { icon: Phone, label: 'Phone', value: '+91 88510 96461', href: 'tel:+918851096461' },
  {
    icon: MapPin,
    label: 'Registered address',
    value: 'S Block, 376, Block S, Panchsheel Park, New Delhi 110017',
    href: undefined,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-lg text-slate-600">
        Have a question about plans, security, or onboarding? Reach out — we typically respond within one
        business day.
      </p>

      <Card className="mt-10">
        <CardContent className="space-y-5">
          {CONTACT_DETAILS.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50">
                <Icon className="h-5 w-5 text-brand-700" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                {href ? (
                  <a href={href} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                    {value}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-slate-900">{value}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
