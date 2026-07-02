import { ActivityItem } from '@/hooks/use-dashboard';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/cn';

function relativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getActionMeta(action: string): { dotColor: string; label: string } {
  const u = action.toUpperCase();
  if (u.includes('UPLOAD') || u.includes('CREATE')) return { dotColor: 'bg-emerald-500', label: 'created' };
  if (u.includes('DELETE') || u.includes('REMOVE')) return { dotColor: 'bg-red-400', label: 'deleted' };
  if (u.includes('DOWNLOAD')) return { dotColor: 'bg-blue-500', label: 'downloaded' };
  if (u.includes('INVITE') || u.includes('MEMBER')) return { dotColor: 'bg-violet-500', label: 'invited' };
  if (u.includes('UPDATE') || u.includes('EDIT')) return { dotColor: 'bg-amber-400', label: 'updated' };
  if (u.includes('VIEW') || u.includes('ACCESS')) return { dotColor: 'bg-slate-400', label: 'viewed' };
  return { dotColor: 'bg-slate-300', label: action.toLowerCase().replace(/_/g, ' ') };
}

function actorLabel(item: ActivityItem): string {
  if (!item.user) return 'System';
  return `${item.user.firstName} ${item.user.lastName}`;
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent Activity</p>
        <Activity className="h-4 w-4 text-slate-300" aria-hidden="true" />
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Activity className="h-5 w-5 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">No activity yet</p>
          <p className="mt-1 text-xs text-slate-400">Actions across your data rooms will appear here.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const meta = getActionMeta(item.action);
            return (
              <li key={item.id} className="flex items-start gap-3">
                <span className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', meta.dotColor)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{actorLabel(item)}</span>
                    {' '}
                    <span className="text-slate-500">{meta.label}</span>
                    {item.dataRoom && (
                      <>
                        {' '}
                        <span className="text-slate-400">in</span>
                        {' '}
                        <span className="font-medium text-slate-600">{item.dataRoom.name}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="flex-shrink-0 whitespace-nowrap text-xs text-slate-400">
                  {relativeTime(item.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
