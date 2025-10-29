import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User, TokenResponse } from '../types/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('current_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setCurrentUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }

    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Use empty string for relative URLs (Docker/nginx proxy), otherwise use configured URL
      const apiUrl = import.meta.env.VITE_API_URL === '' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');
      // Real API call
      const response = await axios.post<TokenResponse>(
        `${apiUrl}/api/v1/auth/login`,
        { username, password }
      );

      const { access_token, user } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('current_user', JSON.stringify(user));

      setToken(access_token);
      setCurrentUser(user);

      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL === '' ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');
      await axios.post(`${apiUrl}/api/v1/auth/logout`);
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('current_user');

      setToken(null);
      setCurrentUser(null);

      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const value = {
    currentUser,
    isAuthenticated: !!token,
    loading,
    login,
    logout,
    token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}