export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1);
  return withSlash;
}

export function pathMatches(pathname: string, paths: '*' | string[]): boolean {
  if (paths === '*') return true;
  const path = normalizePath(pathname);
  return paths.some((spec) => {
    if (spec.endsWith('/*')) {
      const prefix = normalizePath(spec.slice(0, -2));
      return path === prefix || path.startsWith(`${prefix}/`);
    }
    return path === normalizePath(spec);
  });
}

export function hostMatches(hostname: string, hosts: string[]): boolean {
  const host = hostname.toLowerCase();
  return hosts.some((candidate) => candidate.toLowerCase() === host);
}
