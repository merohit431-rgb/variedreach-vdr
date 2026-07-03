import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-app-border2 bg-app-s2/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-primary/10">
        <Icon className="h-6 w-6 text-app-primary" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-medium text-app-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-app-t3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
