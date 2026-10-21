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

  // Sign Up form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn.current) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('A valid email address is required.');
      return;
    }

    if (!signUpPassword || signUpPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    signingIn.current = true;
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          username: username.trim() || undefined,
          email: cleanEmail,
          password: signUpPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'Failed to create account. Please check your information and try again.');
        setPending(false);
        signingIn.current = false;
        return;
      }

      // Automatically sign in with credentials upon registration
      const authIdentifier = data?.user?.username || cleanEmail;
      const signInResult = await signIn('credentials', {
        email: authIdentifier,
        password: signUpPassword,
        redirect: false,
        redirectTo: safeReturnTo(returnTo),
      });

      if (!signInResult?.ok || signInResult.error) {
        setActiveTab('login');
        setIdentifier(authIdentifier);
        setError('Account created! Please log in with your password.');
        setPending(false);
        signingIn.current = false;
        return;
      }

      router.replace(safeReturnTo(returnTo));
    } catch {
      setError('Registration failed due to a network error. Please try again.');
      setPending(false);
      signingIn.current = false;
    }
  };

  return (
    <aside className={styles.form}>
      <header className={styles.header}>
        <p className={styles.login}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className={styles.loginButton}
            onClick={() => {
              setActiveTab(isSignUp ? 'login' : 'signup');
              setError(null);
            }}
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </p>

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
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.inputs}>
            <div className={styles.rowInputs}>
              <AuthInput
                label="Full Name"
                type="text"
                placeholder="Alex Rivers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
              <AuthInput
                label="Username"
                type="text"
                placeholder="alex_rivers"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={pending}
              />
            </div>
            <AuthInput
              label="Email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
            <AuthInput
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              disabled={pending}
            />
            <div className={styles.rowInputs}>
              <AuthInput
                label="Age Range"
                type="select"
                placeholder="Select Age"
                options={AGE_OPTIONS}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={pending}
              />
              <AuthInput
                label="Gender"
                type="select"
                placeholder="Select Gender"
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <section className={styles.cta}>
            <AuthButton
              disabled={pending || !email.trim() || !signUpPassword || signUpPassword.length < 6}
              loading={pending}
            >
              Create Account
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
