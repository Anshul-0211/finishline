/**
 * Groups commitments by domain and returns the count per domain.
 */
export function computeDomainBalance(commitments: { domain?: string }[]): Record<string, number> {
  const balance: Record<string, number> = {
    academic: 0,
    work: 0,
    personal: 0,
    health: 0,
    social: 0,
    family: 0
  };

  commitments.forEach(c => {
    if (c && typeof c.domain === 'string') {
      const d = c.domain.toLowerCase();
      if (d in balance) {
        balance[d]++;
      } else {
        balance[d] = 1;
      }
    }
  });

  return balance;
}
