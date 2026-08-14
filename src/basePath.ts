// Prefixes root-absolute internal paths (e.g. "/events.html", "/images/logo.svg")
// with Vite's configured base path, so the built site still resolves its own
// links/assets correctly when served under a URL prefix (e.g. a Tailscale
// Funnel path-mount at /sig-espresso/). No-op for the default base ("/"),
// so normal dev/build behavior is unchanged. External URLs (https://...)
// pass through untouched.
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}${path}`
}
