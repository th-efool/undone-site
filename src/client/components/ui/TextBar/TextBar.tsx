'use client';

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  type InputHTMLAttributes,
  type ReactNode,
  type FormEvent,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import styles from './TextBar.module.css';

export type TextBarVariant = 'pill' | 'card' | 'default' | 'ghost' | 'underline';
export type TextBarSize = 'sm' | 'md' | 'lg';

export interface TextBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onSubmit'> {
  /** Visual style variant of the outer container */
  variant?: TextBarVariant;
  /** Size scale affecting height, padding, and font size */
  size?: TextBarSize;
  /** Element placed at the start of the bar (e.g., icons, buttons) */
  leftSlot?: ReactNode;
  /** Element placed at the end of the bar (e.g., submit button, keyboard hint) */
  rightSlot?: ReactNode;
  /** Additional action elements rendered before the rightSlot */
  actions?: ReactNode;
  /** Show an interactive clear button when value is present */
  clearable?: boolean;
  /** Callback fired when the clear button is clicked */
  onClear?: () => void;
  /** Submission handler fired on Enter or form submit */
  onSubmit?: ((value: string, e?: FormEvent) => void) | ((e: FormEvent) => void);
  /** Whether the outer wrapper is a `<form>` element (defaults to true if onSubmit is provided) */
  asForm?: boolean;
  /** Custom class for the outer shell/container */
  className?: string;
  /** Custom class for the inner `<input>` element */
  inputClassName?: string;
  /** Custom styles for the outer container */
  style?: CSSProperties;
  /** Custom styles for the inner input */
  inputStyle?: CSSProperties;
  /** Whether the bar expands to 100% of parent width (default: true) */
  fullWidth?: boolean;
}

/**
 * TextBar is the global, bulletproof input bar element designed to eliminate
 * nested focus box-shadows, rogue highlights, and awkward browser outlines.
 *
 * Focus management is strictly encapsulated on the outer container (`:focus-within`),
 * while the inner `<input>` is fully normalized and bare.
 */
export const TextBar = forwardRef<HTMLInputElement, TextBarProps>(function TextBar(
  {
    variant = 'pill',
    size = 'md',
    leftSlot,
    rightSlot,
    actions,
    clearable = false,
    onClear,
    onSubmit,
    asForm,
    className,
    inputClassName,
    style,
    inputStyle,
    fullWidth = true,
    value,
    defaultValue,
    onChange,
    disabled,
    placeholder = 'Search...',
    type = 'text',
    autoComplete = 'off',
    ...rest
  },
  forwardedRef,
) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => internalInputRef.current as HTMLInputElement);

  const [internalValue, setInternalValue] = useState(
    (value !== undefined ? value : defaultValue ?? '') as string,
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled ? String(value ?? '') : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const handleClear = useCallback(() => {
    if (!isControlled) {
      setInternalValue('');
    }
    if (internalInputRef.current) {
      internalInputRef.current.value = '';
      const event = new Event('input', { bubbles: true });
      internalInputRef.current.dispatchEvent(event);
      internalInputRef.current.focus();
    }
    onClear?.();
  }, [isControlled, onClear]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      (onSubmit as (val: string, ev?: FormEvent) => void)(currentValue, e);
    }
  };

  const shouldRenderForm = asForm ?? Boolean(onSubmit);
  const ContainerElement = shouldRenderForm ? 'form' : 'div';
  const containerProps = shouldRenderForm ? { onSubmit: handleSubmit } : {};

  return (
    <ContainerElement
      {...containerProps}
      className={clsx(
        styles.shell,
        styles[variant],
        styles[size],
        {
          [styles.fullWidth]: fullWidth,
          [styles.disabled]: disabled,
        },
        className,
      )}
      style={style}
    >
      {leftSlot && <div className={clsx(styles.slot, styles.leftSlot)}>{leftSlot}</div>}

      <input
        ref={internalInputRef}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-bare-input="true"
        data-textbar-input="true"
        className={clsx(styles.input, inputClassName)}
        style={inputStyle}
        {...rest}
      />

      {clearable && currentValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearBtn}
          aria-label="Clear text"
          tabIndex={-1}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}

      {actions && <div className={clsx(styles.slot)}>{actions}</div>}

      {rightSlot && <div className={clsx(styles.slot, styles.rightSlot)}>{rightSlot}</div>}
    </ContainerElement>
  );
});

TextBar.displayName = 'TextBar';
