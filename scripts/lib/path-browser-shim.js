export function extname(input = '') {
  const normalized = String(input);
  const lastDot = normalized.lastIndexOf('.');
  const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (lastDot <= lastSlash) return '';
  return normalized.slice(lastDot);
}

export function join(...segments) {
  const parts = segments
    .flatMap((segment) => String(segment || '').split(/[\\/]+/))
    .filter(Boolean);
  let joined = parts.join('/');
  if (segments.length && String(segments[0] || '').startsWith('/')) {
    joined = `/${joined}`;
  }
  return joined || '.';
}

export default { extname, join };
