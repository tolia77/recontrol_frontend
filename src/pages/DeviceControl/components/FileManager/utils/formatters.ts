import { classify } from './fileTypes';

/**
 * Format a byte count in Explorer-style binary units (1024). No decimals at
 * the byte scale; one decimal from KB through GB. Returns '' if called with a
 * non-finite or negative value -- callers should suppress this for directories.
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(1)} ${units[unitIdx]}`;
}

/**
 * Format an ISO string or Date for the Modified column. Mirrors the
 * ProcessesModal convention: short, locale-aware, no seconds to keep the
 * column tight.
 */
export function formatDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) {
    return typeof iso === 'string' ? iso : '';
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Human-readable "Type" column value.
 * Directories render as "Folder"; other files return a coarse label derived
 * from {@link classify}, with a touch of specificity for common extensions
 * (PNG, MP4, TypeScript, etc.). Extension is NOT shown verbatim -- the name
 * column already carries it.
 */
export function formatType(name: string, isDirectory: boolean): string {
  if (isDirectory) return 'Folder';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 && dot < name.length - 1
    ? name.slice(dot + 1).toLowerCase()
    : '';
  const kind = classify(name);

  // Special-case a few well-known extensions for nicer labels.
  if (kind === 'image') {
    if (ext === 'svg') return 'SVG image';
    if (ext === 'ico') return 'Icon';
    return `${ext.toUpperCase()} image`;
  }
  if (kind === 'video') return `${ext.toUpperCase()} video`;
  if (kind === 'code') {
    if (ext === 'ts' || ext === 'tsx') return 'TypeScript file';
    if (ext === 'js' || ext === 'jsx') return 'JavaScript file';
    if (ext === 'cs') return 'C# file';
    if (ext === 'json') return 'JSON file';
    if (ext === 'yaml' || ext === 'yml') return 'YAML file';
    if (ext === 'html') return 'HTML file';
    if (ext === 'css' || ext === 'scss') return 'Stylesheet';
    return 'Code file';
  }
  if (kind === 'doc') {
    if (ext === 'pdf') return 'PDF document';
    return 'Document';
  }
  if (kind === 'text') {
    if (ext === 'md') return 'Markdown';
    return 'Text';
  }
  return ext ? `${ext.toUpperCase()} file` : 'File';
}
