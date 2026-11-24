import { CODE_ALPHABET, formatCode, generateCode, normalizeCode } from './inviteCode'

test.each([
  ['k7qm 4xrt', 'K7QM4XRT'],
  ['K7QM-4XRT', 'K7QM4XRT'],
  ['K7QM-4XRT-extra', 'K7QM4XRT'],
  ['  k7-q m ', 'K7QM'],
  ['', ''],
])('normalizeCode(%j) = %j', (input, expected) => {
  expect(normalizeCode(input)).toBe(expected)
})

test.each([
  ['K7QM4XRT', 'K7QM-4XRT'],
  ['K7QM4', 'K7QM-4'],
  ['K7QM', 'K7QM'],
  ['K7Q', 'K7Q'],
])('formatCode(%j) = %j', (input, expected) => {
  expect(formatCode(input)).toBe(expected)
})

test('generateCode: 8 characters from the alphabet, no look-alikes', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCode()
    expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{8}$`))
    expect(code).not.toMatch(/[01OI]/)
  }
})

test('generateCode uses the given random source', () => {
  expect(generateCode(() => 0)).toBe('AAAAAAAA')
  expect(generateCode(() => 0.9999)).toBe('99999999')
})
