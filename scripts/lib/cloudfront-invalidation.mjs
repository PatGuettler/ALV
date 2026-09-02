const DEFAULT_MAX_PATHS = 100;

export function invalidationPathsForKey(key) {
  const normalized = String(key || '').replace(/^\/+/, '');
  if (!normalized) return [];
  const objectPath = `/${normalized}`;
  const paths = [objectPath];
  if (normalized === 'index.html') {
    paths.push('/');
    return [...new Set(paths)];
  }
  if (normalized.endsWith('/index.html')) {
    const directory = `/${normalized.slice(0, -'index.html'.length)}`;
    paths.push(directory, directory.replace(/\/$/, ''));
  }
  return [...new Set(paths)];
}

export function planCloudFrontInvalidation(manifest, { maxPaths = DEFAULT_MAX_PATHS } = {}) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  const paths = [
    ...new Set(
      files
        .filter((file) => file && file.immutable !== true)
        .flatMap((file) => invalidationPathsForKey(file.key)),
    ),
  ].sort();
  if (paths.length > maxPaths) {
    throw new Error(
      `Invalidation plan has ${paths.length} paths; the approved bound is ${maxPaths}.`,
    );
  }
  return {
    quantity: paths.length,
    paths,
  };
}
