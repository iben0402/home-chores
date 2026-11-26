import { useEffect, useState } from 'react'

/** Live `matchMedia` result (false where matchMedia doesn't exist, e.g. tests). */
export function useMediaQuery(query: string): boolean {
  const get = () => window.matchMedia?.(query).matches ?? false
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}
