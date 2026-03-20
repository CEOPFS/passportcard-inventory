import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Household, Device, Child, Alert, WakeSession } from '../types';

interface AppState {
  // Auth
  token: string | null;
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, household: Household) => void;
  clearAuth: () => void;

  // Devices
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  updateDevice: (id: string, data: Partial<Device>) => void;

  // Children
  children: Child[];
  setChildren: (children: Child[]) => void;
  addChild: (child: Child) => void;
  updateChild: (id: string, data: Partial<Child>) => void;
  removeChild: (id: string) => void;

  // Alerts
  alerts: Alert[];
  unreadAlertCount: number;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  removeAlert: (id: string) => void;

  // Active wake sessions
  activeSessions: Record<string, {
    state: string;
    message: string;
    childName: string;
    attempt?: number;
    confidence?: number;
  }>;
  updateActiveSession: (sessionId: string, data: any) => void;
  removeActiveSession: (sessionId: string) => void;

  // UI
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      token: null,
      user: null,
      household: null,
      isAuthenticated: false,
      setAuth: (token, user, household) => {
        localStorage.setItem('wakebot_token', token);
        set({ token, user, household, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('wakebot_token');
        localStorage.removeItem('wakebot_user');
        set({ token: null, user: null, household: null, isAuthenticated: false });
      },

      // Devices
      devices: [],
      setDevices: (devices) => set({ devices }),
      updateDevice: (id, data) =>
        set((state) => ({
          devices: state.devices.map((d) => (d.id === id ? { ...d, ...data } : d)),
        })),

      // Children
      children: [],
      setChildren: (children) => set({ children }),
      addChild: (child) => set((state) => ({ children: [...state.children, child] })),
      updateChild: (id, data) =>
        set((state) => ({
          children: state.children.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      removeChild: (id) =>
        set((state) => ({
          children: state.children.filter((c) => c.id !== id),
        })),

      // Alerts
      alerts: [],
      unreadAlertCount: 0,
      setAlerts: (alerts) =>
        set({
          alerts,
          unreadAlertCount: alerts.filter((a) => !a.read).length,
        }),
      addAlert: (alert) =>
        set((state) => ({
          alerts: [alert, ...state.alerts],
          unreadAlertCount: state.unreadAlertCount + 1,
        })),
      markAlertRead: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
          unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
        })),
      removeAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),

      // Active sessions
      activeSessions: {},
      updateActiveSession: (sessionId, data) =>
        set((state) => ({
          activeSessions: { ...state.activeSessions, [sessionId]: data },
        })),
      removeActiveSession: (sessionId) =>
        set((state) => {
          const { [sessionId]: _, ...rest } = state.activeSessions;
          return { activeSessions: rest };
        }),

      // UI
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'wakebot-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        household: state.household,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
