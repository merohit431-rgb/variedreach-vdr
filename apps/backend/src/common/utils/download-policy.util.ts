import { DownloadPolicy, UserRole } from '@prisma/client';
import { EXTERNAL_ROLES } from '../constants/content-roles';

export type RequestedFormat = 'original' | 'watermarked';

export type DownloadDecision = { allowed: true; format: RequestedFormat } | { allowed: false; reason: string };

// Combines room policy + requester's effective role + the explicitly
// requested format into a single allow/deny decision. Pure -- no IO -- so
// V2.0 policy dimensions (printing, clipboard, IP allowlists, expiry) can
// each be added as an additional parameter here without touching call sites
// beyond passing the new input through.
//
// Hard floor: EXTERNAL_ROLES can never get 'original', regardless of room
// policy. This is a platform-wide floor on top of the per-room policy, not
// part of the policy itself, and isn't configurable per room.
export function resolveDownloadDecision(
  policy: DownloadPolicy,
  effectiveRole: UserRole,
  requestedFormat: RequestedFormat,
): DownloadDecision {
  if (policy === 'PREVIEW_ONLY') {
    return { allowed: false, reason: 'This data room does not allow downloads under its current policy' };
  }

  const isExternal = EXTERNAL_ROLES.includes(effectiveRole);
  const allowsOriginal = (policy === 'ORIGINAL_ONLY' || policy === 'BOTH') && !isExternal;
  const allowsWatermarked = policy === 'WATERMARKED_ONLY' || policy === 'BOTH';

  if (requestedFormat === 'original') {
    if (!allowsOriginal) {
      const reason = isExternal
        ? 'Your role cannot download original files in this data room'
        : 'Original file downloads are not enabled for this data room';
      return { allowed: false, reason };
    }
    return { allowed: true, format: 'original' };
  }

  // requestedFormat === 'watermarked'. Note the deliberate fail-closed edge
  // case: policy ORIGINAL_ONLY + an external requester has both
  // allowsOriginal=false (floor) and allowsWatermarked=false (room never
  // enabled it) -- no download at all for that user, rather than silently
  // granting a watermarked copy the room admin never turned on.
  if (!allowsWatermarked) {
    return { allowed: false, reason: 'Watermarked downloads are not enabled for this data room' };
  }
  return { allowed: true, format: 'watermarked' };
}

// What formats, if any, this room+role combination exposes at all -- used by
// getMyAccess() to tell the frontend which download buttons to render. Built
// on resolveDownloadDecision so the two never drift apart.
export function resolveAvailableFormats(policy: DownloadPolicy, effectiveRole: UserRole): RequestedFormat[] {
  return (['original', 'watermarked'] as const).filter(
    (format) => resolveDownloadDecision(policy, effectiveRole, format).allowed,
  );
}
