import { Badge } from '@/components/ui/Badge';

const IS_STAGING = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging';

export function EnvironmentBanner() {
  if (!IS_STAGING) return null;

  return (
    <div className="flex h-7 flex-shrink-0 items-center justify-center bg-amber-400 text-xs font-semibold tracking-wide text-amber-950">
      STAGING ENVIRONMENT — not production data
    </div>
  );
}

export function EnvironmentBadge() {
  if (!IS_STAGING) return null;

  return <Badge tone="warning">STAGING</Badge>;
}
