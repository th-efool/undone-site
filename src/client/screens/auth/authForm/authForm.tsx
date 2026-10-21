'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { safeReturnTo } from '@/src/shared/auth/returnTo';
import styles from './authForm.module.css';
import { AuthProviders } from './authProviders';
import { AuthDivider } from './authDivider';
import { AuthInput } from './authInput';
import { AuthButton } from './authButton';
import { AuthLegal } from './authLegal';

const AGE_OPTIONS = [
  { value: 'under-18', label: 'Under 18' },
  { value: '18-24', label: '18 – 24' },
  { value: '25-34', label: '25 – 34' },
  { value: '35-44', label: '35 – 44' },
  { value: '45+', label: '45+' },
];

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export function AuthForm({ returnTo = '/home' }: { returnTo?: string }) {
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('signup');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingIn = useRef(false);
  const router = useRouter();
  const isSignUp = activeTab === 'signup';

  const guestSignIn = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        email: 'guest@undone.com',
        redirect: false,
        redirectTo: safeReturnTo(returnTo),
      });
      if (!result?.ok || result.error) {
        setError('Guest sign-in could not create a saved account. Try again or use GitHub or Slack.');
        setPending(false);
        signingIn.current = false;
        return;
      }
      router.replace(safeReturnTo(returnTo));
    } catch {
      setError('Sign-in is unavailable. Please retry.');
      setPending(false);
      signingIn.current = false;
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn.current || !identifier.trim() || !password) return;
    signingIn.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        email: identifier.trim(),
        password,
        redirect: false,
        redirectTo: safeReturnTo(returnTo),
      });
      if (!result?.ok || result.error) {
        setError('Invalid email/username or password. Please check your credentials and try again.');
        setPending(false);
        signingIn.current = false;
        return;
      }
      router.replace(safeReturnTo(returnTo));
    } catch {
      setError('Sign-in is unavailable. Please retry.');
      setPending(false);
      signingIn.current = false;
    }
  };

  return (
    <aside className={styles.form}>
      <header className={styles.header}>
        <div className={styles.tabSwitcher}>
          <button
            type="button"
            className={`${styles.tabButton} ${isSignUp ? styles.active : ''}`}
            aria-pressed={isSignUp}
            onClick={() => {
              setActiveTab('signup');
              setError(null);
            }}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${!isSignUp ? styles.active : ''}`}
            aria-pressed={!isSignUp}
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
          >
            Log In
          </button>
        </div>

        <h1 className={styles.title}>
          {isSignUp ? (
            <>
              Every great skill
              <br />
              begins with{' '}
              <span className={styles.highlightWrapper}>
                <span className={styles.highlight}>curiosity.</span>
              </span>
            </>
          ) : (
            <>
              Welcome back to{' '}
              <span className={styles.highlightWrapper}>
                <span className={styles.highlight}>Undone.</span>
              </span>
            </>
          )}
        </h1>

        <p className={styles.description}>
          {isSignUp
            ? 'Turn playlists and courses into real progress.'
            : 'Continue where you left off and make progress today.'}
        </p>
      </header>

      <section className={styles.oauth}>
        <AuthProviders returnTo={safeReturnTo(returnTo)} disabled={pending} />
      </section>

      <section className={styles.divider}>
        <AuthDivider />
      </section>

      {isSignUp ? (
        <>
          <p>Email/password sign-in is not available yet. Use GitHub, Slack, or continue as Guest.</p>
          <fieldset disabled className={styles.inputs} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <AuthInput label="Full Name" type="text" placeholder="Alex Rivers" />
            <AuthInput label="Email" type="email" placeholder="you@email.com" />
            <AuthInput label="Password" type="password" placeholder="Password" />
            <div className={styles.rowInputs}>
              <AuthInput label="Age Range" type="select" placeholder="Select Age" options={AGE_OPTIONS} />
              <AuthInput label="Gender" type="select" placeholder="Select Gender" options={GENDER_OPTIONS} />
            </div>
          </fieldset>

          <section className={styles.cta}>
            <AuthButton disabled>Create Account</AuthButton>
            <AuthButton
              variant="secondary"
              loading={pending}
              disabled={pending}
              onClick={guestSignIn}
            >
              Continue as Guest
            </AuthButton>
          </section>
        </>
      ) : (
        <form onSubmit={handleCredentialsSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.inputs}>
            <AuthInput
              label="Email or Username"
              type="text"
              placeholder="e.g. user_alpha or user_alpha@undone.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={pending}
            />
            <AuthInput
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </div>

          <section className={styles.cta}>
            <AuthButton
              disabled={pending || !identifier.trim() || !password}
              loading={pending}
            >
              Log In
            </AuthButton>
            <AuthButton
              variant="secondary"
              loading={pending}
              disabled={pending}
              onClick={guestSignIn}
            >
              Continue as Guest
            </AuthButton>
          </section>
        </form>
      )}

      {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: 8 }}>{error}</p>}

      <section className={styles.legal}>
        <AuthLegal />
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          {isSignUp ? 'Already Inside?' : 'New here?'}
          <button
            type="button"
            className={styles.footerLink}
            onClick={() => {
              setActiveTab(isSignUp ? 'login' : 'signup');
              setError(null);
            }}
          >
            {isSignUp ? 'Log in instead →' : 'Create an account →'}
          </button>
        </p>
      </footer>
    </aside>
  );
}
