'use client';

import { Eye, EyeOff, ChevronDown, User, Mail, Lock, Calendar, Users } from 'lucide-react';
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
  icon?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  name?: string;
};

function getDefaultIcon(label?: string, type?: string) {
  const l = (label || '').toLowerCase();
  if (l.includes('name')) return <User size={15} />;
  if (l.includes('email') || l.includes('username') || type === 'email') return <Mail size={15} />;
  if (l.includes('password') || type === 'password') return <Lock size={15} />;
  if (l.includes('age')) return <Calendar size={15} />;
  if (l.includes('gender')) return <Users size={15} />;
  return null;
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  options = [],
  icon,
  value,
  onChange,
  disabled,
  name,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === 'password';
  const isSelect = type === 'select';
  const displayIcon = icon || getDefaultIcon(label, type);

  return (
    <div className={`${styles.field} ${isFocused ? styles.fieldFocused : ''}`}>
      {displayIcon && <span className={styles.iconWrapper}>{displayIcon}</span>}
      <div className={styles.contentWrapper}>
        {label && <span className={styles.label}>{label}</span>}
        {isSelect ? (
          <select
            className={`${styles.input} ${styles.select}`}
            value={value ?? ''}
            onChange={onChange}
            disabled={disabled}
            name={name}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          >
            <option value="" disabled>
              {placeholder || 'Select...'}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={styles.input}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            name={name}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        )}
      </div>

      {isSelect && <ChevronDown size={14} className={styles.selectIcon} />}

      {isPassword && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
}
