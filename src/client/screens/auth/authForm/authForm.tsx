'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
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

export function AuthForm() {
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('signup');
  const isSignUp = activeTab === 'signup';

  return (
    <aside className={styles.form}>
      <header className={styles.header}>
        {/* Task 2.3 #17: Tab switcher — Sign Up / Log In */}
        <div className={styles.tabSwitcher}>
          <button
            type="button"
            className={`${styles.tabButton} ${isSignUp ? styles.active : ''}`}
            aria-pressed={isSignUp}
            onClick={() => setActiveTab('signup')}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${!isSignUp ? styles.active : ''}`}
            aria-pressed={!isSignUp}
            onClick={() => setActiveTab('login')}
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
                <svg
                  className={styles.underlineFlourish}
                  viewBox="0 0 160 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M3 10.5C28 13.2 58 14.5 88 11.5C118 8.5 142 5.5 157 7.2"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 13.2C44 15 76 14.8 106 12.2C128 10.2 146 7.8 155 9.2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.75"
                  />
                </svg>
              </span>
            </>
          ) : (
            <>
              Welcome back to{' '}
              <span className={styles.highlightWrapper}>
                <span className={styles.highlight}>Undone.</span>
                <svg
                  className={styles.underlineFlourish}
                  viewBox="0 0 160 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M3 10.5C28 13.2 58 14.5 88 11.5C118 8.5 142 5.5 157 7.2"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 13.2C44 15 76 14.8 106 12.2C128 10.2 146 7.8 155 9.2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.75"
                  />
                </svg>
              </span>
            </>
          )}
        </h1>

        <p className={styles.description}>
          {isSignUp
            ? "Turn playlists and courses into real progress."
            : "Continue where you left off and make progress today."}
        </p>
      </header>

      <section className={styles.oauth}>
        <AuthProviders />
      </section>

      <section className={styles.divider}>
        <AuthDivider />
      </section>

      <section className={styles.inputs}>
        {isSignUp && (
          <AuthInput
            label="Full Name"
            type="text"
            placeholder="Alex Rivers"
          />
        )}

        <AuthInput
          label="Email"
          type="email"
          placeholder="you@email.com"
        />

        <AuthInput
          label="Password"
          type="password"
          placeholder="Password"
        />

        {isSignUp && (
          <div className={styles.rowInputs}>
            <AuthInput
              label="Age Range"
              type="select"
              placeholder="Select Age"
              options={AGE_OPTIONS}
            />
            <AuthInput
              label="Gender"
              type="select"
              placeholder="Select Gender"
              options={GENDER_OPTIONS}
            />
          </div>
        )}
      </section>

      <section className={styles.cta}>
        <AuthButton href="/explore">{isSignUp ? "Create Account" : "Log In"}</AuthButton>

        <AuthButton
          variant="secondary"
          onClick={() => {
            signIn('credentials', {
              email: 'guest@undone.com',
              callbackUrl: '/home'
            });
          }}
        >
          Continue as Guest
        </AuthButton>
      </section>

      <section className={styles.legal}>
        <AuthLegal />
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          {isSignUp ? "Already Inside?" : "New here?"}
          <button
            type="button"
            className={styles.footerLink}
            onClick={() => setActiveTab(isSignUp ? 'login' : 'signup')}
          >
            {isSignUp ? "Log in instead →" : "Create an account →"}
          </button>
        </p>
      </footer>
    </aside>
  );
}
