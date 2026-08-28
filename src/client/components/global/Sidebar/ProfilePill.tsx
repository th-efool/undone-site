import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import styles from './ProfilePill.module.css';

export function ProfilePill() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session?.user) return null;

  const user = session.user;
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className={styles.container} ref={pillRef}>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <span className={styles.name}>{user.name || 'User'}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
          <div className={styles.divider} />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={styles.logoutButton}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
      
      <button 
        className={styles.pill} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        {user.image ? (
          <Image 
            src={user.image} 
            alt={user.name || 'User'} 
            width={44} 
            height={44} 
            className={styles.avatar}
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
