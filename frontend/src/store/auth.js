import { create } from 'zustand';
import api from '../api/client.js';

export const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem('am_user') || 'null'),
  token: localStorage.getItem('am_token'),
  loading: false,
  error: null,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/login', { username, password });
      localStorage.setItem('am_token', data.token);
      localStorage.setItem('am_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      return data.user;
    } catch (e) {
      set({ loading: false, error: e.response?.data?.message || 'Login failed' });
      throw e;
    }
  },

  logout() {
    localStorage.removeItem('am_token');
    localStorage.removeItem('am_user');
    set({ user: null, token: null });
  },

  setUser(user) {
    localStorage.setItem('am_user', JSON.stringify(user));
    set({ user });
  },
}));

export const isAdmin = () => {
  const u = JSON.parse(localStorage.getItem('am_user') || 'null');
  return u?.role === 'admin';
};
