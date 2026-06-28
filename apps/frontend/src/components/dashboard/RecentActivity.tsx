import { ActivityItem } from '@/hooks/use-dashboard';

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function actorLabel(item: ActivityItem): string {
  if (!item.user) return 'System';
  return `${item.user.firstName} ${item.user.lastName}`;
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Recent activity</p>
        <p className="mt-3 text-sm text-slate-400">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">Recent activity</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700">
              <span className="font-medium">{actorLabel(item)}</span> {humanizeAction(item.action).toLowerCase()}
              {item.dataRoom && <span className="text-slate-500"> in {item.dataRoom.name}</span>}
            </span>
            <span className="whitespace-nowrap text-xs text-slate-400">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
