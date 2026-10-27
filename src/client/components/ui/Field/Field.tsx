'use client';

import React, { useId } from 'react';
import clsx from 'clsx';
import styles from './Field.module.css';

export interface FieldBaseProps {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/* ── TextField ── */

export interface TextFieldProps
  extends FieldBaseProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'id'> {
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  mono?: boolean;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    id: explicitId,
    label,
    hint,
    error,
    required,
    disabled,
    mono,
    leftAdornment,
    rightAdornment,
    className,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx(styles.fieldWrapper, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.requiredAsterisk}>*</span>}
        </label>
      )}

      <div
        className={clsx(styles.inputRoot, {
          [styles.inputError]: Boolean(error),
          [styles.inputDisabled]: disabled,
          [styles.inputMono]: mono,
        })}
      >
        {leftAdornment && <span className={styles.adornment}>{leftAdornment}</span>}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={styles.input}
          {...props}
        />
        {rightAdornment && <span className={styles.adornment}>{rightAdornment}</span>}
      </div>

      {error && (
        <div id={errorId} className={styles.error} role="alert">
          {error}
        </div>
      )}
      {!error && hint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}
    </div>
  );
});

/* ── SelectField ── */

export interface SelectFieldProps
  extends FieldBaseProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  options?: Array<{ label: string; value: string }>;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  {
    id: explicitId,
    label,
    hint,
    error,
    required,
    disabled,
    options,
    className,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx(styles.fieldWrapper, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.requiredAsterisk}>*</span>}
        </label>
      )}

      <div
        className={clsx(styles.selectRoot, {
          [styles.inputError]: Boolean(error),
          [styles.inputDisabled]: disabled,
        })}
      >
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={styles.select}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
      </div>

      {error && (
        <div id={errorId} className={styles.error} role="alert">
          {error}
        </div>
      )}
      {!error && hint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}
    </div>
  );
});

/* ── CheckboxField ── */

export interface CheckboxFieldProps
  extends Omit<FieldBaseProps, 'hint'>,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  description?: React.ReactNode;
}

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  {
    id: explicitId,
    label,
    description,
    error,
    disabled,
    required,
    className,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const descId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, descId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx(styles.checkboxFieldWrapper, className)}>
      <label htmlFor={id} className={styles.checkboxLabel}>
        <input
          ref={ref}
          type="checkbox"
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={styles.checkboxInput}
          {...props}
        />
        <div className={styles.checkboxTextGroup}>
          <span className={styles.checkboxTitle}>
            {label}
            {required && <span className={styles.requiredAsterisk}>*</span>}
          </span>
          {description && (
            <span id={descId} className={styles.checkboxDescription}>
              {description}
            </span>
          )}
        </div>
      </label>

      {error && (
        <div id={errorId} className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

/* ── RadioField ── */

export interface RadioFieldProps
  extends Omit<FieldBaseProps, 'hint'>,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  description?: React.ReactNode;
}

export const RadioField = React.forwardRef<HTMLInputElement, RadioFieldProps>(function RadioField(
  {
    id: explicitId,
    label,
    description,
    error,
    disabled,
    required,
    className,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const descId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, descId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx(styles.checkboxFieldWrapper, className)}>
      <label htmlFor={id} className={styles.checkboxLabel}>
        <input
          ref={ref}
          type="radio"
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={styles.radioInput}
          {...props}
        />
        <div className={styles.checkboxTextGroup}>
          <span className={styles.checkboxTitle}>
            {label}
            {required && <span className={styles.requiredAsterisk}>*</span>}
          </span>
          {description && (
            <span id={descId} className={styles.checkboxDescription}>
              {description}
            </span>
          )}
        </div>
      </label>

      {error && (
        <div id={errorId} className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

export const Field = {
  Text: TextField,
  Select: SelectField,
  Checkbox: CheckboxField,
  Radio: RadioField,
};

export default Field;
