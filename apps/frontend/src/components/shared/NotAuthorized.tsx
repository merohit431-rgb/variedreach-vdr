import { ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotAuthorized({
  description = "You don't have permission to view this.",
}: {
  description?: string;
}) {
  return <EmptyState icon={ShieldOff} title="Not authorized" description={description} />;
}
