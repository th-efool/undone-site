/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';
import { RoomScreen } from '../room/RoomScreen';

const pushSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-viewer', name: 'Test Viewer', image: null },
    },
    status: 'authenticated',
  }),
}));

function fixtureRoom(slug:string, role:'admin'|'member') {
  vi.mocked(studyRoomRepository.getBootstrap).mockResolvedValue({
    room:{id:'r',slug,title:'Library'},viewer:{isJoined:true,userId:'test-viewer',role:role==='admin'?'OWNER':'PARTICIPANT'},
    capabilities:{canJoin:true,canManageParticipants:role==='admin',canControlEnvironment:role==='admin',canEditRoom:role==='admin'}
  } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
  return <RoomScreen roomSlug={slug} />;
}
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' = 'running';
  destination = { connect: vi.fn(), disconnect: vi.fn() };

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
    };
  }

  createBiquadFilter() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'lowpass',
      frequency: { value: 350 },
      Q: { value: 1 },
    };
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
    return Promise.resolve();
  });

  close = vi.fn().mockImplementation(async () => {
    return Promise.resolve();
  });
}

describe('RoomScreen shell component', () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(studyRoomRepository,'getBootstrap').mockResolvedValue({
      room:{id:'r',slug:'library',title:'Library'},viewer:{isJoined:true,userId:'test-viewer'}
    } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
    vi.spyOn(studyRoomRepository,'joinRoom').mockResolvedValue({success:true,generation:1} as Awaited<ReturnType<typeof studyRoomRepository.joinRoom>>);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    cleanup();
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    } else {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('renders room title, atmosphere, and default sound chip', async () => {
    await act(async () => {
      render(fixtureRoom('library','admin'));
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeTruthy();
    expect(screen.getByText('Silent study & focus')).toBeTruthy();

    // Clicking customize room opens the dock with current sound preset
    fireEvent.click(screen.getByRole('button', { name: 'Customize room environment' }));
    expect(screen.getByText('Rain · playing')).toBeTruthy();
  });

  it('shows "Customize room" for admin and "Room info" for member via viewAsOverride', async () => {
    let unmountFn!: () => void;

    await act(async () => {
      const { unmount } = render(fixtureRoom('library','admin'));
      unmountFn = unmount;
    });

    expect(screen.getByRole('button', { name: 'Customize room environment' })).toBeTruthy();
    expect(screen.getByText("You're the host")).toBeTruthy();

    unmountFn();

    await act(async () => {
      render(fixtureRoom('library','member'));
    });

    expect(screen.getByRole('button', { name: 'Room information' })).toBeTruthy();
    expect(screen.queryByText("You're the host")).toBeNull();
    expect(screen.getByText('Host: Mira')).toBeTruthy();
  });

  it('switches panels such that only one panel is open at any time', async () => {
    await act(async () => {
      render(fixtureRoom('library','member'));
    });

    // Initially no dialog panel is open
    expect(screen.queryByRole('dialog')).toBeNull();

    // 1. Open Session panel
    const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
    fireEvent.click(sessionBtn);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Session Tasks & Goal' })).toBeTruthy();

    // 2. Open People panel: replaces Session panel (never two open)
    const peopleBtn = screen.getByRole('button', { name: /People, \d+ studying now/ });
    fireEvent.click(peopleBtn);

    expect(screen.queryByRole('heading', { name: 'Session Tasks & Goal' })).toBeNull();
    expect(screen.getByRole('heading', { name: /People · \d+/ })).toBeTruthy();

    // 3. Clicking People again toggles it closed
    fireEvent.click(peopleBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes open panel when Escape key is pressed', async () => {
    let containerElem!: HTMLElement;
    await act(async () => {
      const { container } = render(fixtureRoom('library','member'));
      containerElem = container;
    });

    const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
    fireEvent.click(sessionBtn);

    expect(screen.getByRole('dialog')).toBeTruthy();

    const stage = containerElem.querySelector('section');
    expect(stage).toBeTruthy();

    fireEvent.keyDown(stage!, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('persists session tasks and goal draft across panel close and reopen', async () => {
    await act(async () => {
      render(fixtureRoom('library','member'));
    });

    // 1. Open Session panel
    const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
    fireEvent.click(sessionBtn);

    // 2. Type a goal draft and add a task
    const goalInput = screen.getByLabelText("What's your goal for this session?") as HTMLInputElement;
    fireEvent.change(goalInput, { target: { value: 'Write Chapter 1' } });

    const taskInput = screen.getByLabelText('Add a task') as HTMLInputElement;
    fireEvent.change(taskInput, { target: { value: 'Draft outline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(screen.getByText('Draft outline')).toBeTruthy();

    // 3. Close the Session panel
    fireEvent.click(sessionBtn);
    expect(screen.queryByRole('dialog')).toBeNull();

    // 4. Reopen Session panel
    fireEvent.click(sessionBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();

    // 5. Verify goal draft and added task are preserved
    const reopenedGoalInput = screen.getByLabelText("What's your goal for this session?") as HTMLInputElement;
    expect(reopenedGoalInput.value).toBe('Write Chapter 1');
    expect(screen.getByText('Draft outline')).toBeTruthy();
  });

  it('enforces privacy invariant: goal text is hidden in People panel when Private, visible when Visible to room', async () => {
    await act(async () => {
      render(fixtureRoom('library','member'));
    });

    const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
    const peopleBtn = screen.getByRole('button', { name: /People, \d+ studying now/ });

    // 1. Open Session panel, enter goal "Secret plan", commit it (private by default)
    fireEvent.click(sessionBtn);
    const goalInput = screen.getByLabelText("What's your goal for this session?");
    fireEvent.change(goalInput, { target: { value: 'Secret plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // 2. Open People panel: "Secret plan" must NOT be in the DOM
    fireEvent.click(peopleBtn);
    expect(screen.queryByText('Secret plan')).toBeNull();

    // 3. Switch back to Session panel and select "Visible to room"
    fireEvent.click(sessionBtn);
    const roomRadio = screen.getByRole('radio', { name: /Visible to room/ });
    fireEvent.click(roomRadio);

    // 4. Open People panel: "Secret plan" MUST appear in DOM
    fireEvent.click(peopleBtn);
    expect(screen.getAllByText('Secret plan').length).toBeGreaterThanOrEqual(1);

    // 5. Switch back to Session panel and select "Private" again
    fireEvent.click(sessionBtn);
    const privateRadio = screen.getByRole('radio', { name: /Private/ });
    fireEvent.click(privateRadio);

    // 6. Open People panel: "Secret plan" must be GONE
    fireEvent.click(peopleBtn);
    expect(screen.queryByText('Secret plan')).toBeNull();
  });

  it('navigates immediately on Leave when no personal state exists', async () => {
    await act(async () => {
      render(fixtureRoom('library','member'));
    });

    const leaveBtn = screen.getByRole('button', { name: 'Leave room' });
    fireEvent.click(leaveBtn);

    expect(pushSpy).toHaveBeenCalledWith('/studyroom');
    expect(screen.queryByText('Leave this room?')).toBeNull();
  });
});
