// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { YoutubeUnits } from '../components/YoutubeUnits';
afterEach(cleanup);
const units = [{ unitId: 'dQw4w9WgXcQ', title: 'Lighting lesson', durationSeconds: 120 }, { unitId: 'AAAAAAAAAAA', title: 'Reflectance lesson', durationSeconds: 180 }];
describe('explicit video scope', () => {
  it('limits additional choices while keeping deselection available', async () => {
    const save = vi.fn(async () => true);
    render(<YoutubeUnits units={units} selected={['AAAAAAAAAAA']} disabled={false} maxSelected={1} onSave={save} />);
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Reflectance lesson/) as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText(/Reflectance lesson/)); fireEvent.click(screen.getByLabelText(/Lighting lesson/));
    fireEvent.click(screen.getByRole('button', { name: 'Save video selection' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(['dQw4w9WgXcQ']));
  });
  it('requires narrowing local choices when other sources consume capacity', async () => {
    const save = vi.fn(async () => true);
    const props = { units, selected: ['AAAAAAAAAAA'], disabled: false, onSave: save };
    const view = render(<YoutubeUnits {...props} maxSelected={1} />);
    view.rerender(<YoutubeUnits {...props} maxSelected={0} />);
    expect(screen.getByRole('alert').textContent).toContain('Deselect videos');
    const button = screen.getByRole('button', { name: 'Save video selection' });
    fireEvent.submit(button.closest('form')!); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/Reflectance lesson/)); fireEvent.click(button);
    await waitFor(() => expect(save).toHaveBeenCalledWith([]));
  });
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
    expect(screen.getByRole('alert').textContent).toContain('not acknowledged');
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save video selection' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText(/Lighting lesson/)); fireEvent.click(screen.getByRole('button', { name: 'Save video selection' }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith([]));
  });
  it('serializes save requests and retains choices after unexpected rejection', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    render(<YoutubeUnits units={units} selected={['AAAAAAAAAAA']} disabled={false} onSave={save} />);
    const form = screen.getByRole('form', { name: 'Video scope' }); fireEvent.submit(form); fireEvent.submit(form);
    expect(save).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be saved'));
    expect((screen.getByLabelText(/Reflectance lesson/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: 'Save video selection' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('blocks edits while material work is active', () => {
    const save = vi.fn(); render(<YoutubeUnits units={units} selected={[]} disabled onSave={save} />);
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save video selection' }) as HTMLButtonElement).disabled).toBe(true); expect(save).not.toHaveBeenCalled();
  });
});


describe('selection and preparation', () => {
  it('preselects one video locally and prepares only after save succeeds', async () => {
    const order: string[] = []; const save = vi.fn(async () => { order.push('save'); return true; });
    const prepare = vi.fn(async () => { order.push('prepare'); return true; });
    render(<YoutubeUnits units={[units[0]]} selected={[]} disabled={false} onSave={save} onPrepare={prepare} />);
    expect((screen.getByLabelText(/Lighting lesson/) as HTMLInputElement).checked).toBe(true);
    expect(save).not.toHaveBeenCalled(); expect(prepare).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use selected videos' }));
    await waitFor(() => expect(order).toEqual(['save', 'prepare']));
    expect(save).toHaveBeenCalledWith(['dQw4w9WgXcQ']);
  });
  it('does not prepare unacknowledged selections', async () => {
    const prepare = vi.fn();
    render(<YoutubeUnits units={[units[0]]} selected={[]} disabled={false} onSave={async () => false} onPrepare={prepare} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use selected videos' }));
    await screen.findByRole('alert'); expect(prepare).not.toHaveBeenCalled();
  });
  it('requires explicit playlist selection and exposes failed preparation', async () => {
    render(<YoutubeUnits units={units} selected={[]} disabled={false} onSave={async () => true} onPrepare={async () => false} />);
    expect((screen.getByRole('button', { name: 'Use selected videos' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Lighting lesson/));
    fireEvent.click(screen.getByRole('button', { name: 'Use selected videos' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('preparation could not start'));
  });
});
