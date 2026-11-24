/**
 * Where to go after signing in, from a `?next=` value. Only same-site paths are allowed:
 * "/h/abc" yes; "//evil.example", "/\evil", "https://…", "javascript:…" and anything with
 * control characters (browsers strip tabs/newlines, which turns "/\t/evil" into "//evil") no.
 */
export function safeNext(next: string | null, origin: string = window.location.origin): string {
  // eslint-disable-next-line no-control-regex
  if (!next || !next.startsWith('/') || /[\u0000-\u001F\u007F\\]/.test(next)) return '/'
  try {
    const url = new URL(next, origin)
    return url.origin === origin ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}
