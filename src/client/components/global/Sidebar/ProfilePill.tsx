import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import styles from './ProfilePill.module.css';

export function ProfilePill() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!session?.user) return null;

  const user = session.user;
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className={styles.container} ref={pillRef}>
      {isOpen && (
        <div className={styles.dropdown} role="menu" aria-label="User account menu">
          <div className={styles.userInfo}>
            <span className={styles.name}>{user.name || 'User'}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
          <div className={styles.divider} />
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem('undone:cohort-intake'); void signOut({ callbackUrl: '/' }); }}
            className={styles.logoutButton}
            role="menuitem"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
      
      <button 
        type="button"
        className={styles.pill} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {user.image && !imgError ? (
          <Image 
            src={user.image} 
            alt={user.name || 'User'} 
            width={44} 
            height={44} 
            className={styles.avatar}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {initial}
          </div>
        )}
      </button>
    </div>
  );
}
