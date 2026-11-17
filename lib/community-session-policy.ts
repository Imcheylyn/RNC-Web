export function shouldRetainCommunitySession(status: number | null): boolean {
  return status === null || status === 429 || (status >= 500 && status < 600)
}
