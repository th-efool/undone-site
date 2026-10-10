// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { YoutubeUnits } from '../components/YoutubeUnits';
afterEach(cleanup);
const units = [{ unitId: 'dQw4w9WgXcQ', title: 'Lighting lesson', durationSeconds: 120 }, { unitId: 'AAAAAAAAAAA', title: 'Reflectance lesson', durationSeconds: 180 }];
describe('explicit video scope', () => {
  it('restores confirmed scope and submits actual checkbox choices in source order', async () => {
    const save = vi.fn(async () => true); render(<YoutubeUnits units={units} selected={['AAAAAAAAAAA']} disabled={false} onSave={save} />);
    expect((screen.getByLabelText(/Reflectance lesson/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText(/Lighting lesson/)); fireEvent.click(screen.getByRole('button', { name: 'Save video selection' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(['dQw4w9WgXcQ', 'AAAAAAAAAAA']));
  });
  it('preserves unsaved choices after a failed save and allows clearing selection', async () => {
    const save = vi.fn(async () => false); render(<YoutubeUnits units={units} selected={[]} disabled={false} onSave={save} />);
    fireEvent.click(screen.getByLabelText(/Lighting lesson/)); fireEvent.click(screen.getByRole('button', { name: 'Save video selection' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save video selection' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText(/Lighting lesson/)); fireEvent.click(screen.getByRole('button', { name: 'Save video selection' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith([]));
  });
  it('blocks edits while material work is active', () => {
    const save = vi.fn(); render(<YoutubeUnits units={units} selected={[]} disabled onSave={save} />);
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save video selection' }) as HTMLButtonElement).disabled).toBe(true); expect(save).not.toHaveBeenCalled();
  });
});
