import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'manager' | 'hr' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  termsAccepted?: boolean;
}

interface StoredUser {
  password: string;
  user: User;
  resetToken?: string;
  resetTokenExpiry?: number;
}

type UsersMap = Record<string, StoredUser>;

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; termsAccepted?: boolean }>;
  logout: () => void;
  isAuthenticated: boolean;
  users: User[];
  createUser: (user: User, password: string) => Promise<boolean>;
  updateUser: (user: User) => boolean;
  deleteUser: (email: string) => boolean;
  acceptTerms: () => void;
  forgotPassword: (email: string) => Promise<string | null>;
  validateResetToken: (token: string) => boolean;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  getUserEmailByResetToken: (token: string) => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoUsers: UsersMap = {
  'admin@workwise.app': {
    password: 'Admin!23',
    user: {
      id: '1',
      email: 'admin@workwise.app',
      name: 'Admin User',
      role: 'admin',
      termsAccepted: false
    }
  },
  'manager@workwise.app': {
    password: 'Manager!23',
    user: {
      id: '2',
      email: 'manager@workwise.app',
      name: 'ITSM Manager',
      role: 'manager',
      termsAccepted: false
    }
  },
  'hr@workwise.app': {
    password: 'HR!23',
    user: {
      id: '3',
      email: 'hr@workwise.app',
      name: 'HR Manager',
      role: 'hr',
      termsAccepted: false
    }
  },
  'agent@workwise.app': {
    password: 'Agent!23',
    user: {
      id: '4',
      email: 'agent@workwise.app',
      name: 'IT Support Agent',
      role: 'agent',
      termsAccepted: false
    }
  }
};

const hashPassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(data)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const isPasswordHash = (value: string) => /^[0-9a-f]{64}$/.test(value);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usersMap, setUsersMap] = useState<UsersMap>({});

  const users = Object.values(usersMap).map(entry => entry.user);

  useEffect(() => {
    const storedUser = localStorage.getItem('workwise_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const initializeUsers = async () => {
      const storedUsers = localStorage.getItem('workwise_users');
      const rawUsers: UsersMap = storedUsers ? JSON.parse(storedUsers) : demoUsers;
      const normalized: UsersMap = {};

      for (const [email, entry] of Object.entries(rawUsers)) {
        const password = entry.password || '';
        const hashedPassword = isPasswordHash(password) ? password : await hashPassword(password);
        normalized[email] = {
          ...entry,
          password: hashedPassword,
          user: {
            termsAccepted: false,
            ...entry.user
          }
        };
      }

      setUsersMap(normalized);
      localStorage.setItem('workwise_users', JSON.stringify(normalized));
    };

    initializeUsers();
  }, []);

  const saveUsers = (next: UsersMap) => {
    setUsersMap(next);
    localStorage.setItem('workwise_users', JSON.stringify(next));
  };

  const login = async (email: string, password: string) => {
    const account = usersMap[email];
    if (!account) {
      return { success: false };
    }

    const hashedPassword = await hashPassword(password);
    if (account.password !== hashedPassword) {
      return { success: false };
    }

    setUser(account.user);
    localStorage.setItem('workwise_user', JSON.stringify(account.user));
    return { success: true, termsAccepted: !!account.user.termsAccepted };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('workwise_user');
  };

  const acceptTerms = () => {
    if (!user) return;
    const account = usersMap[user.email];
    if (!account) return;

    const updatedUser = { ...account.user, termsAccepted: true };
    const next = {
      ...usersMap,
      [user.email]: {
        ...account,
        user: updatedUser
      }
    };

    saveUsers(next);
    setUser(updatedUser);
    localStorage.setItem('workwise_user', JSON.stringify(updatedUser));
  };

  const forgotPassword = async (email: string) => {
    const account = usersMap[email];
    if (!account) return null;

    const token = crypto.randomUUID ? crypto.randomUUID() : Array.from(window.crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
    const expiry = Date.now() + 1000 * 60 * 30;
    const next = {
      ...usersMap,
      [email]: {
        ...account,
        resetToken: token,
        resetTokenExpiry: expiry
      }
    };

    saveUsers(next);
    return token;
  };

  const getUserEmailByResetToken = (token: string) => {
    return Object.keys(usersMap).find((email) => usersMap[email].resetToken === token) || null;
  };

  const validateResetToken = (token: string) => {
    const email = getUserEmailByResetToken(token);
    if (!email) return false;
    const account = usersMap[email];
    return Boolean(account.resetToken === token && account.resetTokenExpiry && account.resetTokenExpiry > Date.now());
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const email = getUserEmailByResetToken(token);
    if (!email) return false;

    const account = usersMap[email];
    if (!account || account.resetToken !== token || !account.resetTokenExpiry || account.resetTokenExpiry < Date.now()) {
      return false;
    }

    const hashedPassword = await hashPassword(newPassword);
    const next = {
      ...usersMap,
      [email]: {
        ...account,
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined
      }
    };

    saveUsers(next);
    return true;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return false;
    const account = usersMap[user.email];
    if (!account) return false;

    const currentHash = await hashPassword(currentPassword);
    if (account.password !== currentHash) {
      return false;
    }

    const newHash = await hashPassword(newPassword);
    const next = {
      ...usersMap,
      [user.email]: {
        ...account,
        password: newHash,
        resetToken: undefined,
        resetTokenExpiry: undefined
      }
    };

    saveUsers(next);
    return true;
  };

  const updateUser = (updated: User) => {
    const existingKey = Object.keys(usersMap).find((email) => usersMap[email].user.id === updated.id);
    if (!existingKey) return false;

    if (updated.email !== existingKey && usersMap[updated.email]) {
      return false;
    }

    const existing = usersMap[existingKey];
    const nextMap = { ...usersMap };

    if (updated.email !== existingKey) {
      delete nextMap[existingKey];
    }

    nextMap[updated.email] = {
      ...existing,
      user: {
        ...existing.user,
        ...updated
      }
    };

    saveUsers(nextMap);

    if (user?.id === updated.id) {
      setUser(nextMap[updated.email].user);
      localStorage.setItem('workwise_user', JSON.stringify(nextMap[updated.email].user));
    }

    return true;
  };

  const createUser = async (newUser: User, password: string) => {
    if (usersMap[newUser.email]) return false;

    const hashedPassword = await hashPassword(password);
    const next = {
      ...usersMap,
      [newUser.email]: {
        password: hashedPassword,
        user: {
          ...newUser,
          termsAccepted: false
        }
      }
    };

    saveUsers(next);
    return true;
  };

  const deleteUser = (emailToDelete: string) => {
    if (!usersMap[emailToDelete]) return false;
    const allUsers = Object.values(usersMap).map((entry) => entry.user);
    const adminCount = allUsers.filter((u) => u.role === 'admin').length;
    if (usersMap[emailToDelete].user.role === 'admin' && adminCount <= 1) return false;

    const copy = { ...usersMap };
    delete copy[emailToDelete];
    saveUsers(copy);

    if (user?.email === emailToDelete) {
      setUser(null);
      localStorage.removeItem('workwise_user');
    }

    return true;
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
        getUserEmailByResetToken
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
