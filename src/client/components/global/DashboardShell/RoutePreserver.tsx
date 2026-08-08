'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';

interface RoutePreserverProps {
  children: React.ReactNode;
}

/**
 * RoutePreserver preserves the currently visible page during client-side navigation
 * until the incoming page is ready to render. This prevents visual jumps and skeleton flashing
 * when navigating between dashboard screens.
 */
export function RoutePreserver({ children }: RoutePreserverProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [displayedRoute, setDisplayedRoute] = useState<{
    pathname: string;
    children: React.ReactNode;
  }>({
    pathname,
    children,
  });

  useEffect(() => {
    if (pathname !== displayedRoute.pathname) {
      startTransition(() => {
        setDisplayedRoute({ pathname, children });
      });
    } else {
      setDisplayedRoute({ pathname, children });
    }
  }, [pathname, children, displayedRoute.pathname]);

  return (
    <div
      data-route={displayedRoute.pathname}
      data-pending={isPending}
      style={{
        width: '100%',
        height: '100%',
        opacity: isPending ? 0.94 : 1,
        transition: 'opacity 0.15s ease-out',
      }}
    >
      {displayedRoute.children}
    </div>
  );
}
