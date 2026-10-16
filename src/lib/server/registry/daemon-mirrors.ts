/**
 * #1157: Dockhand's own registry lookups (the manifest digest behind "check for updates")
 * were sent straight to Docker Hub's API host, ignoring the `registry-mirrors` configured
 * in the Docker daemon. On a host that can only reach Docker Hub through a mirror, every
 * Hub image then reported "Registry unreachable: index.docker.io (ECONNREFUSED)" while
 * `docker pull` kept working fine, because only the daemon reads that setting.
 *
 * The daemon does report its mirrors on `GET /info`, so the digest can be read from the
 * daemon instead. This module holds the pure normalisation of that field so it can be
 * unit-tested without pulling in docker/db.
 */

/**
 * Normalise `RegistryConfig.Mirrors` from `GET /info` into bare `host[:port]` values.
 *
 * Docker reports mirrors with a scheme and a trailing slash (`https://docker.example.com/`),
 * which cannot be compared against a registry host directly. Entries without a usable
 * hostname are dropped, duplicates collapse, and a daemon that reports no mirrors (or a
 * response in an unexpected shape) yields an empty list.
 */
export function mirrorsFromDaemonInfo(info: unknown): string[] {
	const raw = (info as { RegistryConfig?: { Mirrors?: unknown } } | null | undefined)
		?.RegistryConfig?.Mirrors;
	if (!Array.isArray(raw)) return [];

	const hosts: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'string') continue;
		const trimmed = entry.trim();
		if (!trimmed) continue;
		let url: URL;
		try {
			url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
		} catch {
			continue;
		}
		if (!url.hostname) continue;
		const value = url.port ? `${url.hostname}:${url.port}` : url.hostname;
		if (!hosts.includes(value)) hosts.push(value);
	}
	return hosts;
}

/** True when the daemon would resolve Docker Hub through a mirror. */
export function daemonHasRegistryMirrors(info: unknown): boolean {
	return mirrorsFromDaemonInfo(info).length > 0;
}
