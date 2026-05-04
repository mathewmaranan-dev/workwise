import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'manager' | 'hr' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  users: User[];
  createUser: (user: User, password: string) => boolean;
  updateUser: (user: User) => void;
  deleteUser: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users (email -> { password, user })
const demoUsers: Record<string, { password: string; user: User }> = {
  'admin@workwise.app': {
    password: 'Admin!23',
    user: {
      id: '1',
      email: 'admin@workwise.app',
      name: 'Admin User',
      role: 'admin'
    }
  },
  'manager@workwise.app': {
    password: 'Manager!23',
    user: {
      id: '2',
      email: 'manager@workwise.app',
      name: 'ITSM Manager',
      role: 'manager'
    }
  },
  'hr@workwise.app': {
    password: 'HR!23',
    user: {
      id: '3',
      email: 'hr@workwise.app',
      name: 'HR Manager',
      role: 'hr'
    }
  },
  'agent@workwise.app': {
    password: 'Agent!23',
    user: {
      id: '4',
      email: 'agent@workwise.app',
      name: 'IT Support Agent',
      role: 'agent'
    }
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, { password: string; user: User }>>({});

  // helper to get users array
  const users = Object.values(usersMap).map(entry => entry.user);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('workwise_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load persisted users or initialize with demo users
    const storedUsers = localStorage.getItem('workwise_users');
    if (storedUsers) {
      try {
        setUsersMap(JSON.parse(storedUsers));
      } catch (e) {
        setUsersMap(demoUsers);
        localStorage.setItem('workwise_users', JSON.stringify(demoUsers));
      }
    } else {
      setUsersMap(demoUsers);
      localStorage.setItem('workwise_users', JSON.stringify(demoUsers));
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const account = usersMap[email];
    if (account && account.password === password) {
      setUser(account.user);
      localStorage.setItem('workwise_user', JSON.stringify(account.user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('workwise_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      users,
      createUser: (newUser: User, password: string) => {
        if (usersMap[newUser.email]) return false; // already exists
        const next = { ...usersMap, [newUser.email]: { password, user: newUser } };
        setUsersMap(next);
        localStorage.setItem('workwise_users', JSON.stringify(next));
        return true;
      },
      updateUser: (updated: User) => {
        if (!usersMap[updated.email]) {
          // maybe email changed; find by id and replace
          const foundEmail = Object.keys(usersMap).find(e => usersMap[e].user.id === updated.id);
          if (foundEmail) {
            const password = usersMap[foundEmail].password;
            const copy = { ...usersMap };
            delete copy[foundEmail];
            copy[updated.email] = { password, user: updated };
            setUsersMap(copy);
            localStorage.setItem('workwise_users', JSON.stringify(copy));
            // also update session if current user
            if (user?.id === updated.id) {
              setUser(updated);
              localStorage.setItem('workwise_user', JSON.stringify(updated));
            }
            return;
          }
          return;
        }
        const next = { ...usersMap, [updated.email]: { ...usersMap[updated.email], user: updated } };
        setUsersMap(next);
        localStorage.setItem('workwise_users', JSON.stringify(next));
        if (user?.id === updated.id) {
          setUser(updated);
          localStorage.setItem('workwise_user', JSON.stringify(updated));
        }
      },
      deleteUser: (emailToDelete: string) => {
        if (!usersMap[emailToDelete]) return false;
        // prevent deleting last admin
        const allUsers = Object.values(usersMap).map(x => x.user);
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (usersMap[emailToDelete].user.role === 'admin' && adminCount <= 1) return false;
        const copy = { ...usersMap };
        delete copy[emailToDelete];
        setUsersMap(copy);
        localStorage.setItem('workwise_users', JSON.stringify(copy));
        // if deleted current user, logout
        if (user?.email === emailToDelete) {
          setUser(null);
          localStorage.removeItem('workwise_user');
        }
        return true;
      }
    }}>
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
