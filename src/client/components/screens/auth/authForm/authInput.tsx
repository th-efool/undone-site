'use client';

import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import styles from './authInput.module.css';

type Option = {
  value: string;
  label: string;
};

type AuthInputProps = {
  label?: string;
  type?: 'text' | 'email' | 'password' | 'select';
  placeholder?: string;
  options?: Option[];
};

export function AuthInput({ label, type = 'text', placeholder, options = [] }: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const isSelect = type === 'select';

  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.inputWrapper}>
        {isSelect ? (
          <>
            <select className={`${styles.input} ${styles.select}`} defaultValue="">
              <option value="" disabled>
                {placeholder || 'Select an option'}
              </option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className={styles.selectIcon} />
          </>
        ) : (
          <input
            className={styles.input}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            placeholder={placeholder}
          />
        )}

        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </label>
  );
}
