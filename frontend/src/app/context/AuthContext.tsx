import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'manager' | 'hr' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  first_name?: string;
  last_name?: string;
  assignment_group_id?: number;
  assignment_group?: string;
  termsAccepted?: boolean;
  shift?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; termsAccepted?: boolean }>;
  logout: () => void;
  isAuthenticated: boolean;
  users: User[];
  createUser: (user: User, password: string, assignment_group_id?: number) => Promise<boolean>;
  updateUser: (user: User) => Promise<boolean>;
  deleteUser: (email: string) => Promise<{ success: boolean; message?: string }>;
  acceptTerms: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string | null>;
  validateResetToken: (token: string) => boolean;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  getUserEmailByResetToken: (token: string) => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const env = (import.meta as any).env as Record<string, string | undefined>;
const API_BASE = env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:5000';

const normalizeRole = (role: any): UserRole => {
  const normalized = String(role || '').trim().toLowerCase();
  if (['admin', 'manager', 'hr', 'agent'].includes(normalized)) {
    return normalized as UserRole;
  }
  if (normalized.includes('manager')) {
    return 'manager';
  }
  if (normalized.includes('hr')) {
    return 'hr';
  }
  if (normalized.includes('agent')) {
    return 'agent';
  }
  if (normalized.includes('admin')) {
    return 'admin';
  }
  return 'agent';
};

const parseApiUser = (raw: any): User => {
  const first_name = raw.first_name || raw.firstName || '';
  const last_name = raw.last_name || raw.lastName || '';
  const name = raw.name || `${first_name} ${last_name}`.trim();

  return {
    id: String(raw.id || raw.user_id),
    email: raw.email,
    role: normalizeRole(raw.role || raw.role_name),
    name: name || raw.email,
    createdAt: raw.created_at || raw.createdAt || undefined,
    first_name,
    last_name,
    assignment_group_id: raw.assignment_group_id ? Number(raw.assignment_group_id) : undefined,
    assignment_group: raw.assignment_group || raw.assignment_group_name || undefined,
    termsAccepted: !!(raw.termsAccepted || raw.terms_accepted),
    shift: raw.shift || undefined,
  };
};

const demoUsers: Record<string, { password: string; user: User }> = {
  'admin@workwise.app': {
    password: 'Admin!23',
    user: {
      id: '1',
      email: 'admin@workwise.app',
      name: 'Admin User',
      role: 'admin',
      termsAccepted: false,
    },
  },
};

const hashPassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(data)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const getAuthToken = () => token || localStorage.getItem('workwise_token');

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = getAuthToken();
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  const fetchUsers = async (authToken: string) => {
    if (!API_BASE) return false;
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const result = await response.json();
      const parsedUsers = result.map((row: any) => parseApiUser(row));
      setUsers(parsedUsers);
      return true;
    } catch (error) {
      console.warn('Failed to fetch users from backend', error);
      return false;
    }
  };

  const fetchCurrentUser = async (authToken: string) => {
    if (!API_BASE) return false;
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Session expired');
      }
      const result = await response.json();
      const currentUser = parseApiUser(result);
      setUser(currentUser);
      localStorage.setItem('workwise_token', authToken);
      localStorage.setItem('workwise_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin') {
        await fetchUsers(authToken);
      }
      return true;
    } catch (error) {
      console.warn('Failed to restore backend session', error);
      logout();
      return false;
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('workwise_token');
    if (storedToken) {
      setToken(storedToken);
      fetchCurrentUser(storedToken);
    }
  }, []);

  const login = async (email: string, password: string) => {
    if (!API_BASE) {
      const account = demoUsers[email];
      if (account && account.password === password) {
        setUser(account.user);
        localStorage.setItem('workwise_user', JSON.stringify(account.user));
        return { success: true, termsAccepted: !!account.user.termsAccepted };
      }
      return { success: false };
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error('Invalid credentials');
      }
      const result = await response.json();
        const authToken = result.token;
        const currentUser = parseApiUser(result.user);
      setToken(authToken);
      setUser(currentUser);
      localStorage.setItem('workwise_token', authToken);
      localStorage.setItem('workwise_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin') {
        await fetchUsers(authToken);
      }
        return { success: true, termsAccepted: !!currentUser.termsAccepted };
    } catch (error) {
      console.warn('Login failed', error);
      return { success: false };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setUsers([]);
    localStorage.removeItem('workwise_token');
    localStorage.removeItem('workwise_user');
  };

  const acceptTerms = async () => {
    if (!user || !API_BASE || !getAuthToken()) return;
    try {
      const response = await fetch(`${API_BASE}/api/auth/accept-terms`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!response.ok) {
        console.error('Accept terms failed');
        return;
      }
      const updated = parseApiUser(await response.json());
      setUser(updated);
      localStorage.setItem('workwise_user', JSON.stringify(updated));
    } catch (error) {
      console.error('Accept terms error:', error);
    }
  };

  const forgotPassword = async (email: string) => {
    return null;
  };

  const getUserEmailByResetToken = (token: string) => null;

  const validateResetToken = (token: string) => false;

  const resetPassword = async (token: string, newPassword: string) => false;

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!API_BASE || !getAuthToken()) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      return response.ok;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  };

  const getNameParts = (fullName: string) => {
    const parts = fullName.trim().split(' ').filter(Boolean);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
    };
  };

  const createUser = async (newUser: User, password: string, assignment_group_id?: number) => {
    const authToken = getAuthToken();
    if (!API_BASE || !authToken) {
      return false;
    }

    try {
      // Prefer explicit first_name/last_name provided by the form.
      const providedFirst = (newUser as any).first_name?.trim();
      const providedLast = (newUser as any).last_name?.trim();
      const nameParts = getNameParts(newUser.name);
      const first_name = providedFirst || nameParts.first_name;
      const last_name = providedLast || nameParts.last_name;
      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          first_name,
          last_name,
          email: newUser.email,
          password,
          role: newUser.role,
          assignment_group_id: (assignment_group_id ?? newUser.assignment_group_id) || null,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create user failed', response.status, errorText);
        return false;
      }
      const createdUser = parseApiUser(await response.json());
      setUsers((prev) => [createdUser, ...prev]);
      return true;
    } catch (error) {
      console.error('Create user error:', error);
      return false;
    }
  };

  const updateUser = async (updated: User) => {
    if (!API_BASE || !token) {
      return false;
    }

    try {
      const { first_name, last_name } = getNameParts(updated.name);
      const response = await fetch(`${API_BASE}/api/users/${updated.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          first_name,
          last_name,
          role: updated.role,
          assignment_group_id: updated.assignment_group_id ?? null,
        }),
      });
      if (!response.ok) {
        return false;
      }
      const parsedUser = parseApiUser(await response.json());
      setUsers((prev) => prev.map((user) => (user.id === parsedUser.id ? parsedUser : user)));
      if (user?.id === parsedUser.id) {
        setUser(parsedUser);
        localStorage.setItem('workwise_user', JSON.stringify(parsedUser));
      }
      return true;
    } catch (error) {
      console.error('Update user error:', error);
      return false;
    }
  };

  const deleteUser = async (emailToDelete: string) => {
    if (!API_BASE || !token) {
      return { success: false, message: 'Not connected to API' };
    }

    const existing = users.find((u) => u.email === emailToDelete);
    if (!existing) {
      return { success: false, message: 'User not found' };
    }

    try {
      const response = await fetch(`${API_BASE}/api/users/${existing.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) {
        let msg = 'Failed to delete user';
        try {
          const body = await response.json();
          msg = body?.error || body?.message || msg;
        } catch (e) {
          try {
            msg = await response.text();
          } catch (e) {
            // ignore
          }
        }
        return { success: false, message: msg };
      }
      setUsers((prev) => prev.filter((u) => u.id !== existing.id));
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, message: 'Delete request failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        users,
        createUser,
        updateUser,
        deleteUser,
        acceptTerms,
        forgotPassword,
        validateResetToken,
        resetPassword,
        changePassword,
        getUserEmailByResetToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
