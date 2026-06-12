/** e.g. "Joe Smith" or "Joe Smith and +2 people" */
export function formatBookingPartyLabel(
  guestName: string,
  golfers: number,
): string {
  const name = guestName.trim()
  if (golfers <= 1) return name
  const extra = golfers - 1
  return `${name} and +${extra} ${extra === 1 ? 'person' : 'people'}`
}
