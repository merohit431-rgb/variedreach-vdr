import { ShieldCheck, Stamp, KeyRound, History, FolderTree, HardDrive, FileStack, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

const FEATURES = [
  {
    icon: KeyRound,
    title: 'Granular role-based access',
    description:
      'Eight distinct roles — from Organisation Admin to Resolution Professional, CoC Member, Auditor, and Guest — each scoped to exactly what they need to see.',
  },
  {
    icon: Stamp,
    title: 'Dynamic per-download watermarking',
    description:
      'Every PDF download is watermarked on the fly with the recipient\'s identity and timestamp, making leaks traceable back to the source.',
  },
  {
    icon: Settings2,
    title: 'Configurable document access policy',
    description:
      'Set a per-data-room policy — preview only, original downloads, watermarked downloads, or both — enforced consistently for every file in that room.',
  },
  {
    icon: History,
    title: 'Complete audit trail',
    description:
      'Every view, download, upload, and permission change is logged with who, what, and when — exportable for compliance review.',
  },
  {
    icon: FileStack,
    title: 'Version history',
    description: 'Upload new versions of a document without losing the trail — every prior version stays accessible to authorised users.',
  },
  {
    icon: FolderTree,
    title: 'Structured data rooms',
    description: 'Organise documents into folders by category, with bulk upload support for fast onboarding of large document sets.',
  },
  {
    icon: HardDrive,
    title: 'Storage management',
    description: 'Track storage consumption per organisation with proactive threshold alerts before you run out of room.',
  },
  {
    icon: ShieldCheck,
    title: 'Office document preview',
    description: 'Word, Excel, and PowerPoint files are converted and previewed in-browser — no need to download to review.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Features</h1>
        <p className="mt-3 text-lg text-slate-600">
          Everything you need to share confidential documents with the right people, and prove who saw what.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
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
