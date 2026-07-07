// Best-effort "City, Country" for a public IP, via a free lookup service.
// Called once at login (not on every session list read) so a slow/unreachable
// service never blocks or slows down authentication -- a short timeout and
// any failure just means no location is shown, matching "if available".
const LOOKUP_TIMEOUT_MS = 1500;
const PRIVATE_IP_PATTERN = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/;

export async function resolveApproximateLocation(ipAddress: string | undefined): Promise<string | null> {
  if (!ipAddress || PRIVATE_IP_PATTERN.test(ipAddress)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,city,country`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { status: string; city?: string; country?: string };
    if (data.status !== 'success') return null;

    return [data.city, data.country].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
