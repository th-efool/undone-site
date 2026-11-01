// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SiteFailureBridge } from '../SiteFailureBridge';
import { reportSiteFailure, failureMessages } from '../site-failures';
import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
afterEach(cleanup);
it('uses the shared provider and leaves the editable page intact', () => {
  render(<ToastProvider><SiteFailureBridge /><input aria-label="Draft" defaultValue="Keep this" /></ToastProvider>);
  act(() => reportSiteFailure('message'));
  expect(screen.getByRole('alert').textContent).toContain(failureMessages.message);
  expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Keep this');
});
