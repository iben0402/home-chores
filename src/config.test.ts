import firebaseJson from '../firebase.json'

test('hosting rewrites all paths to index.html', () => {
  expect(firebaseJson.hosting.public).toBe('dist')
  expect(firebaseJson.hosting.rewrites).toContainEqual({ source: '**', destination: '/index.html' })
})
