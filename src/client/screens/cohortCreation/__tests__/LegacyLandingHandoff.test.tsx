// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';
const fake = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../CreationExperience', () => ({ CreationExperience: (props: unknown) => { fake.create(props); return <p>Existing creator</p>; } }));
import { LegacyLandingHandoff } from '../LegacyLandingHandoff';
afterEach(() => { cleanup(); sessionStorage.clear(); fake.create.mockClear(); });
it('hands a private prompt to v1 only after explicit owner confirmation', () => {
  const requestId = '54103d7b-2709-4dd6-bb18-522f96b97241';
  saveIntakeDraft({ requestId, prompt: 'Private learning goal' },null);
  render(<LegacyLandingHandoff ownerId="owner" />);
  expect(screen.getByText('Private learning goal')).toBeTruthy();
  expect(fake.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{ name:'Continue with existing creator' }));
  expect(fake.create).toHaveBeenCalledWith({ draftId:requestId, initialQuery:'Private learning goal' });
  expect(window.location.search).toBe('');
});
it('does not expose another account’s pending input', () => {
  saveIntakeDraft({ requestId:'54103d7b-2709-4dd6-bb18-522f96b97241', prompt:'Private learning goal' },'owner');
  render(<LegacyLandingHandoff ownerId="different-owner" />);
  expect(screen.queryByText('Private learning goal')).toBeNull();
  expect(fake.create).not.toHaveBeenCalled();
});
