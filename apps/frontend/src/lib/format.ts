export function formatBytes(bytes: number | string): string {
  const value = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** exponent;

  return `${exponent === 0 ? size : size.toFixed(1)} ${units[exponent]}`;
}

// Middle-ellipsis, not end-ellipsis: similarly-named documents in a VDR
// often differ only at the end (a version number, a date, "(1)" vs "(2)"),
// so chopping the end alone makes distinct files look identical in the list.
export function truncateFilename(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;

  const remaining = maxLength - 3;
  const frontLength = Math.ceil(remaining / 2);
  const backLength = Math.floor(remaining / 2);

  return `${name.slice(0, frontLength)}...${name.slice(name.length - backLength)}`;
}
