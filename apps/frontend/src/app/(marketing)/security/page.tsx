import { Stamp, KeyRound, History, Lock, ShieldAlert, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

const SECURITY_PILLARS = [
  {
    icon: Stamp,
    title: 'Leak traceability',
    description:
      'Downloads can be watermarked with the recipient\'s name, email, and timestamp, so a leaked document can always be traced back to who downloaded it.',
  },
  {
    icon: KeyRound,
    title: 'Role-based access control',
    description:
      'Access is scoped by role at the data room level. External parties — bidders, auditors, legal advisors, guests — never see more than what they\'re explicitly granted.',
  },
  {
    icon: Eye,
    title: 'Configurable download policy',
    description:
      'Data room owners choose what downloading is allowed at all: preview-only, original files, watermarked files, or both — applied consistently to everyone in that room.',
  },
  {
    icon: ShieldAlert,
    title: 'External-role safeguards',
    description:
      'External roles are never given an unwatermarked original, even if a room\'s policy would otherwise allow it — a hard floor that protects the source document by default.',
  },
  {
    icon: History,
    title: 'Full audit logging',
    description: 'Every access, download, upload, and permission change is recorded immutably and is reviewable by administrators.',
  },
  {
    icon: Lock,
    title: 'Encrypted in transit',
    description: 'All traffic is served over TLS, with authenticated sessions and short-lived access tokens.',
  },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Security</h1>
        <p className="mt-3 text-lg text-slate-600">
          Built around a simple principle: confidential documents should only ever reach the people authorised to
          see them, and every access should be traceable.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {SECURITY_PILLARS.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardContent>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                <Icon className="h-5 w-5 text-brand-700" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
