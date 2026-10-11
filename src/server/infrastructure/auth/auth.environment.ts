/**
 * This app serves more than one public hostname. Auth.js v5 otherwise replaces
 * incoming request URLs with AUTH_URL/NEXTAUTH_URL, moving callbacks and secure
 * cookies to a legacy hostname. Use the deployment's trusted request headers.
 * Run once at initialization, never mutate origins for individual requests.
 */
export function configureRequestOriginAuth(env: Record<string, string | undefined> = process.env) {
  delete env.AUTH_URL;
  delete env.NEXTAUTH_URL;
}
