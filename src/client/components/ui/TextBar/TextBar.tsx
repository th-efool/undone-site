'use client';

import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import styles from './TextBar.module.css';

export type TextBarVariant = 'pill' | 'card' | 'default' | 'ghost' | 'underline' | 'prompt';
export type TextBarSize = 'sm' | 'md' | 'lg';

export type ResponsiveMaxRows =
  | number
  | {
      base?: number; // < 640px (default: 4)
      sm?: number;   // 640px - 767px (default: 5)
      md?: number;   // 768px - 1023px (default: 6)
      lg?: number;   // >= 1024px (default: 8)
    };

export interface TextBarProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>,
    'size' | 'onSubmit'
  > {
  /** Visual style variant of the outer container */
  variant?: TextBarVariant;
  /** Size scale affecting height, padding, and font size */
  size?: TextBarSize;
  /** Whether to render an auto-expanding multiline textarea */
  multiline?: boolean;
  /** Minimum rows to display initially (default: 1) */
  minRows?: number;
  /** Maximum rows before vertical scrolling activates (responsive by screen width) */
  maxRows?: ResponsiveMaxRows;
  /** Element placed at the start of the bar (e.g., icons, buttons) */
  leftSlot?: ReactNode;
  /** Element placed at the end of the bar (e.g., submit button, keyboard hint) */
  rightSlot?: ReactNode;
  /** Additional action elements rendered before the rightSlot */
  actions?: ReactNode;
  /** Bottom action toolbar rendered below the input/textarea inside the card */
  bottomBar?: ReactNode;
  /** Show an interactive clear button when value is present */
  clearable?: boolean;
  /** Callback fired when the clear button is clicked */
  onClear?: () => void;
  /** Submission handler fired on Enter or form submit */
  onSubmit?: ((value: string, e?: FormEvent) => void) | ((e: FormEvent) => void);
  /** Whether pressing plain Enter submits in multiline mode (default: true). If false, Enter inserts a newline and Cmd/Ctrl+Enter submits */
  submitOnEnter?: boolean;
  /** Whether the outer wrapper is a `<form>` element (defaults to true if onSubmit is provided) */
  asForm?: boolean;
  /** Custom class for the outer shell/container */
  className?: string;
  /** Custom class for the inner input or textarea */
  inputClassName?: string;
  /** Custom styles for the outer container */
  style?: CSSProperties;
  /** Custom styles for the inner input/textarea */
  inputStyle?: CSSProperties;
  /** Whether the bar expands to 100% of parent width (default: true) */
  fullWidth?: boolean;
}

/**
 * TextBar is the global, bulletproof input bar element designed to eliminate
 * nested focus box-shadows, rogue highlights, and awkward browser outlines.
 *
 * Focus management is strictly encapsulated on the outer container (`:focus-within`),
 * while the inner `<input>` or auto-extending `<textarea>` is fully normalized and bare.
 */
export const TextBar = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextBarProps>(
  function TextBar(
    {
      variant = 'pill',
      size = 'md',
      multiline = false,
      minRows = 1,
      maxRows,
      leftSlot,
      rightSlot,
      actions,
      bottomBar,
      clearable = false,
      onClear,
      onSubmit,
      submitOnEnter = true,
      asForm,
      className,
      inputClassName,
      style,
      inputStyle,
      fullWidth = true,
      value,
      defaultValue,
      onChange,
      onKeyDown,
      disabled,
      placeholder = 'Search...',
      type = 'text',
      autoComplete = 'off',
      ...rest
    },
    forwardedRef,
  ) {
    const internalInputRef = useRef<HTMLInputElement>(null);
    const internalTextareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(
      forwardedRef,
      () =>
        (multiline
          ? internalTextareaRef.current
          : internalInputRef.current) as HTMLInputElement & HTMLTextAreaElement,
    );

    const [internalValue, setInternalValue] = useState(
      (value !== undefined ? value : defaultValue ?? '') as string,
    );

    const isControlled = value !== undefined;
    const currentValue = isControlled ? String(value ?? '') : internalValue;

    // Resolve maxRows dynamically based on viewport width
    const getEffectiveMaxRows = useCallback(() => {
      if (typeof window === 'undefined') return typeof maxRows === 'number' ? maxRows : 8;
      const width = window.innerWidth;
      if (typeof maxRows === 'object' && maxRows !== null) {
        if (width >= 1024 && maxRows.lg !== undefined) return maxRows.lg;
        if (width >= 768 && maxRows.md !== undefined) return maxRows.md;
        if (width >= 640 && maxRows.sm !== undefined) return maxRows.sm;
        if (maxRows.base !== undefined) return maxRows.base;
      }
      if (typeof maxRows === 'number') {
        if (width < 640) return Math.min(maxRows, 4);
        if (width < 1024) return Math.min(maxRows, 6);
        return maxRows;
      }
      // Default responsive curve: mobile 4, tablet 6, desktop 8
      if (width < 640) return 4;
      if (width < 1024) return 6;
      return 8;
    }, [maxRows]);

    // Auto-resize logic for multiline textarea (extends vertically up to effectiveMaxRows)
    const adjustHeight = useCallback(() => {
      const el = internalTextareaRef.current;
      if (!el || !multiline) return;

      el.style.height = 'auto';
      const computed = window.getComputedStyle(el);
      const parsedLineHeight = parseFloat(computed.lineHeight) || 24;
      const effectiveMax = getEffectiveMaxRows();
      const maxHeight = parsedLineHeight * effectiveMax;
      const minHeight = parsedLineHeight * minRows;
      const scrollH = el.scrollHeight;

      if (scrollH > maxHeight) {
        el.style.height = `${maxHeight}px`;
        el.style.overflowY = 'auto';
      } else {
        el.style.height = `${Math.max(scrollH, minHeight)}px`;
        el.style.overflowY = 'hidden';
      }
    }, [multiline, minRows, getEffectiveMaxRows]);

    useEffect(() => {
      if (multiline) {
        adjustHeight();
      }
    }, [multiline, currentValue, adjustHeight]);

    useEffect(() => {
      if (!multiline) return;
      const handleResize = () => adjustHeight();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [multiline, adjustHeight]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e as any);
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e as any);
      adjustHeight();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (multiline) {
        const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey;
        const isModifierSubmit = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

        if (submitOnEnter && isPlainEnter) {
          e.preventDefault();
          if (onSubmit) {
            (onSubmit as (val: string, ev?: FormEvent) => void)(currentValue, e as any);
          }
        } else if (isModifierSubmit) {
          e.preventDefault();
          if (onSubmit) {
            (onSubmit as (val: string, ev?: FormEvent) => void)(currentValue, e as any);
          }
        }
      }
      onKeyDown?.(e as any);
    };

    const handleClear = useCallback(() => {
      if (!isControlled) {
        setInternalValue('');
      }
      if (multiline && internalTextareaRef.current) {
        internalTextareaRef.current.value = '';
        const event = new Event('input', { bubbles: true });
        internalTextareaRef.current.dispatchEvent(event);
        adjustHeight();
        internalTextareaRef.current.focus();
      } else if (internalInputRef.current) {
        internalInputRef.current.value = '';
        const event = new Event('input', { bubbles: true });
        internalInputRef.current.dispatchEvent(event);
        internalInputRef.current.focus();
      }
      onClear?.();
    }, [isControlled, multiline, onClear, adjustHeight]);

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
          !bottomBar && styles[size],
          {
            [styles.fullWidth]: fullWidth,
            [styles.disabled]: disabled,
          },
          className,
        )}
        style={style}
      >
        <div className={styles.inputArea}>
          {leftSlot && <div className={clsx(styles.slot, styles.leftSlot)}>{leftSlot}</div>}

          {multiline ? (
            <textarea
              ref={internalTextareaRef}
              value={value}
              defaultValue={defaultValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              rows={minRows}
              data-bare-input="true"
              data-textbar-input="true"
              className={clsx(styles.textarea, inputClassName)}
              style={inputStyle}
              {...(rest as any)}
            />
          ) : (
            <input
              ref={internalInputRef}
              type={type}
              value={value}
              defaultValue={defaultValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete={autoComplete}
              data-bare-input="true"
              data-textbar-input="true"
              className={clsx(styles.input, inputClassName)}
              style={inputStyle}
              {...(rest as any)}
            />
          )}

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
        </div>

        {bottomBar && <div className={styles.bottomBar}>{bottomBar}</div>}
      </ContainerElement>
    );
  },
);

TextBar.displayName = 'TextBar';
