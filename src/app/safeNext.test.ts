import { safeNext } from './safeNext'

const ORIGIN = 'https://chours.example'

test.each([
  ['/h/abc/history', '/h/abc/history'],
  ['/join/K7QM4XRT?x=1#top', '/join/K7QM4XRT?x=1#top'],
])('keeps same-site path %s', (next, expected) => {
  expect(safeNext(next, ORIGIN)).toBe(expected)
})

test.each([
  [null],
  [''],
  ['//evil.example'],
  ['/\\evil.example'],
  ['/\t/evil.example'],
  ['/\n/evil.example'],
  ['/\t\\evil.example'],
  ['https://evil.example'],
  ['javascript:alert(1)'],
  ['h/abc'],
])('rejects %j', (next) => {
  expect(safeNext(next, ORIGIN)).toBe('/')
})
