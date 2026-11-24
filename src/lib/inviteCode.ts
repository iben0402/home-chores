/** No 0/O or 1/I, so codes read aloud and typed by hand don't get mixed up. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8

export function generateCode(random: () => number = secureRandom): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}

/**
 * "k7qm 4xrt" / "K7QM-4XRT" → "K7QM4XRT". Dashes, spaces and other characters don't matter,
 * and a pasted invite link ("…/join/K7QM4XRT") gives its code.
 */
export function normalizeCode(input: string): string {
  const fromLink = /\/join\/([A-Za-z0-9-]+)/.exec(input)?.[1]
  return (fromLink ?? input).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}

/** "K7QM4XRT" → "K7QM-4XRT"; partial codes get the dash once past 4 characters. */
export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

function secureRandom(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] / 2 ** 32
}
