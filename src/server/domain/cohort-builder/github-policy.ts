/** Server-side capability gating for GitHub repository source ingestion.
 * Defaults to disabled unless INTERACTION_GITHUB_ENABLED is explicitly set to '1'. */
export function githubSourceReadiness() {
  const enabled = process.env.INTERACTION_GITHUB_ENABLED === '1';
  if (!enabled) {
    return { enabled: false as const, code: 'GITHUB_CAPABILITY_DISABLED' as const };
  }
  return { enabled: true as const, code: null };
}
