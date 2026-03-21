import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wakebot_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.startsWith('/auth/');
    if (isAuthEndpoint && (error.response?.status === 401 || error.response?.status === 403)) {
      localStorage.removeItem('wakebot_token');
      localStorage.removeItem('wakebot_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post('/auth/reset-password', { email, token, newPassword }),
};

// Vendors
export const vendorApi = {
  getSupported: () => api.get('/vendors/supported'),
  connect: (data: { vendor: string; apiKey?: string; model: string; username?: string; password?: string }) =>
    api.post('/vendors/connect', data),
};

// Devices
export const deviceApi = {
  getAll: () => api.get('/devices'),
  getById: (id: string) => api.get(`/devices/${id}`),
  getMap: (id: string) => api.get(`/devices/${id}/map`),
  navigate: (id: string, data: { x: number; y: number; childId?: string }) =>
    api.post(`/devices/${id}/navigate`, data),
  stop: (id: string) => api.post(`/devices/${id}/stop`),
  playAudio: (id: string, data: { filePath: string; volume?: number }) =>
    api.post(`/devices/${id}/play-audio`, data),
  getStatus: (id: string) => api.get(`/devices/${id}/status`),
};

// Children
export const childrenApi = {
  getAll: () => api.get('/children'),
  getById: (id: string) => api.get(`/children/${id}`),
  create: (data: Partial<{ name: string; age: number; room_name: string; wake_point_x: number; wake_point_y: number; safety_radius: number }>) =>
    api.post('/children', data),
  update: (id: string, data: any) => api.put(`/children/${id}`, data),
  delete: (id: string) => api.delete(`/children/${id}`),
  updateLocation: (id: string, data: { wake_point_x: number; wake_point_y: number; safety_radius?: number; room_name?: string }) =>
    api.put(`/children/${id}/location`, data),
};

// Messages
export const messagesApi = {
  upload: (childId: string, formData: FormData) =>
    api.post(`/children/${childId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getByChild: (childId: string) => api.get(`/children/${childId}/messages`),
  delete: (messageId: string, childId: string) =>
    api.delete(`/messages/${messageId}`),
  updateOrder: (messageId: string, childId: string, orderIndex: number) =>
    api.put(`/messages/${messageId}/order`, { order_index: orderIndex }),
};

// Schedules
export const schedulesApi = {
  create: (childId: string, data: { day_of_week: number; time_of_day: string; enabled?: boolean; exceptions?: string[] }) =>
    api.post(`/children/${childId}/schedules`, data),
  getByChild: (childId: string) => api.get(`/children/${childId}/schedules`),
  update: (scheduleId: string, childId: string, data: any) =>
    api.put(`/schedules/${scheduleId}`, data),
  delete: (scheduleId: string, childId: string) =>
    api.delete(`/schedules/${scheduleId}`),
};

// Wake
export const wakeApi = {
  test: (childId: string) => api.post(`/wake/test/${childId}`),
  start: (childId: string, scheduledAt?: string) =>
    api.post(`/wake/start/${childId}`, { scheduledAt }),
  stop: (sessionId: string) => api.post(`/wake/stop/${sessionId}`),
  getSessions: (params?: { childId?: string; limit?: number; offset?: number }) =>
    api.get('/wake/sessions', { params }),
  getSession: (id: string) => api.get(`/wake/sessions/${id}`),
};

// Alerts
export const alertsApi = {
  getAll: () => api.get('/alerts'),
  markRead: (id: string) => api.put(`/alerts/${id}/read`),
  markAllRead: () => api.put('/alerts/read-all'),
  delete: (id: string) => api.delete(`/alerts/${id}`),
};

export default api;
