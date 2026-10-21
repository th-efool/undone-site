import { apiUrl } from '@/src/shared/api/apiUrl';

export interface UserProfileDTO {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  role: string;
  createdAt: string;
}

export interface UsernameCheckResult {
  available: boolean;
  valid: boolean;
  error?: string;
  normalized: string;
  cleanHandle: string;
}

export const userProfileRepository = {
  async getProfile(): Promise<UserProfileDTO | null> {
    try {
      const res = await fetch(apiUrl('/api/user/profile'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch user profile:', e);
      return null;
    }
  },

  async checkUsername(username: string): Promise<UsernameCheckResult> {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = new URL(apiUrl('/api/user/username'), baseOrigin);
    url.searchParams.set('username', username);

    const res = await fetch(url.toString(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    return await res.json();
  },

  async claimUsername(username: string): Promise<{ success: boolean; user?: Partial<UserProfileDTO>; error?: string }> {
    const res = await fetch(apiUrl('/api/user/username'), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    if (!res.ok) {
      return { success: false, error: data.error || `Failed with status ${res.status}` };
    }

    return { success: true, user: data.user };
  },

  async updateProfile(updates: { name?: string; bio?: string; image?: string }): Promise<UserProfileDTO> {
    const res = await fetch(apiUrl('/api/user/profile'), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || `Update failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.user;
  },
};
