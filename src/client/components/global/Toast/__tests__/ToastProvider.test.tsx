// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ToastProvider';
import { useToast } from '@/src/client/hooks/useToast';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
function Controls() { const toast = useToast(); return <><button onClick={() => toast.info('First', 1000)}>First</button><button onClick={() => toast.info('Second', 2000)}>Second</button><button onClick={() => toast.error('Failed')}>Fail</button></>; }
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('expires from original creation time and keeps errors dismissible', () => {
  vi.useFakeTimers(); render(<ToastProvider><Controls /></ToastProvider>);
  fireEvent.click(screen.getByText('First'));
  act(() => vi.advanceTimersByTime(500)); fireEvent.click(screen.getByText('Second'));
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status').textContent).toContain('Second');
  fireEvent.click(screen.getByText('Fail')); fireEvent.click(screen.getByText('Fail'));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('alert').textContent).toContain('Failed');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
function Failure({ error }: { error: string }) { useFailureToast(error, 'Safe failure text', 'Test'); return <input aria-label="Draft" defaultValue="Keep me" />; }
it('deduplicates renders without losing input or leaking raw error', () => {
  const view = render(<ToastProvider><Failure error="SECRET_RAW_ERROR" /></ToastProvider>);
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Still here' } });
  view.rerender(<ToastProvider><Failure error="SECRET_RAW_ERROR" /></ToastProvider>);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText('SECRET_RAW_ERROR')).toBeNull();
  expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Still here');
});
