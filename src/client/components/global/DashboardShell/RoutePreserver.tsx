'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface RoutePreserverProps {
  children: React.ReactNode;
}

/**
 * RoutePreserver renders the incoming dashboard screen shell immediately on navigation
 * without holding the previous route in a transition.
 */
export function RoutePreserver({ children }: RoutePreserverProps) {
  const pathname = usePathname();

  return (
    <div
      data-route={pathname}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}
