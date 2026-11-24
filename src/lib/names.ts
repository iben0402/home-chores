/** "Anna Nowak" → "Anna". Housemates are named by first name in the UI. */
export function firstName(displayName: string | null | undefined): string {
  return displayName?.trim().split(/\s+/)[0] ?? ''
}
