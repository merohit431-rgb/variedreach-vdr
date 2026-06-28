import Link from 'next/link';

const ACTIONS = [
  { href: '/data-rooms/new', label: 'Create Data Room' },
  { href: '/data-rooms', label: 'View Data Rooms' },
];

export function QuickActions() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">Quick actions</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
