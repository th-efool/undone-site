import Link from 'next/link';
import styles from './authButton.module.css';

type AuthButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
};

export function AuthButton({
  children,
  loading = false,
  disabled = false,
  href,
  variant = 'primary',
  onClick,
}: AuthButtonProps) {
  const className = `${styles.button} ${variant === 'secondary' ? styles.secondary : ''}`;

  if (href) {
    return (
      <Link
        href={href}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled || loading}
      className={className}
      onClick={onClick}
    >
      {loading ? <span className={styles.loader} /> : children}
    </button>
  );
}
