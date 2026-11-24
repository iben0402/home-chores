import firebaseJson from '../firebase.json'

test('hosting rewrites all paths to index.html', () => {
  expect(firebaseJson.hosting.public).toBe('dist')
  expect(firebaseJson.hosting.rewrites).toContainEqual({ source: '**', destination: '/index.html' })
})

// Headers match the *requested* path, not the rewrite destination, so app routes like
// /h/abc/history need the catch-all rule; /assets/** comes after it and overrides it.
test('app pages are never cached and hashed assets are cached forever', () => {
  const headers = (firebaseJson.hosting as { headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }).headers ?? []
  const forSource = (source: string) => headers.find((h) => h.source === source)?.headers
  expect(forSource('**')).toContainEqual({ key: 'Cache-Control', value: 'no-cache' })
  expect(headers.findIndex((h) => h.source === '**')).toBeLessThan(
    headers.findIndex((h) => h.source === '/assets/**'),
  )
  expect(forSource('/assets/**')).toContainEqual({
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable',
  })
})
