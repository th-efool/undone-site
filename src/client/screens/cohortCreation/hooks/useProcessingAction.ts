'use client';
import { useRef, useState } from 'react';

/** UI acknowledgement only; canonical draft state and navigation stay server-owned. */
export function useProcessingAction(blocked: boolean) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const run = async (action: () => Promise<boolean>, label: string) => {
    if (blocked || submitting.current) return;
    submitting.current = true; setPending(true); setError(null);
    try {
      if (!await action()) setError(`${label} was not acknowledged. Check the saved draft before retrying.`);
    } catch {
      setError(`${label} could not be confirmed. Your saved material remains intact. Reload the draft before retrying.`);
    } finally { submitting.current = false; setPending(false); }
  };
  return { pending, error, run };
}
