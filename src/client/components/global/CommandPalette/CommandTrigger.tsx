'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface CommandContextValue {
  open: boolean;
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
  openCommand: () => void;
}

const CommandTriggerContext = createContext<CommandContextValue | undefined>(undefined);

export function CommandTriggerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpen((prev) => (typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next));
    },
    [],
  );

  const openCommand = useCallback(() => setOpen(true), []);

  return (
    <CommandTriggerContext.Provider value={{ open, onOpenChange, openCommand }}>
      {children}
    </CommandTriggerContext.Provider>
  );
}

export function useCommandContext() {
  const ctx = useContext(CommandTriggerContext);
  if (!ctx) {
    throw new Error('useCommandContext must be used within CommandTriggerProvider');
  }
  return ctx;
}
