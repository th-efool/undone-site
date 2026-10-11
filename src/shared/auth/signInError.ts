/** Never render provider/server error details from the URL. */
export function signInErrorMessage(error: unknown): string | null {
  if (typeof error !== 'string' || !error) return null;
  if (error === 'OAuthAccountNotLinked') return 'This email already uses another sign-in provider. Use the provider you originally signed in with.';
  if (error === 'CredentialsSignin') return 'Guest sign-in could not create a saved account. Retry or use GitHub or Slack.';
  if (error === 'Configuration') return 'Sign-in is unavailable because the server authentication configuration needs attention.';
  if (error === 'AccessDenied') return 'Sign-in was denied. Try an account with access.';
  return 'Sign-in did not complete. Please retry or choose another provider.';
}
