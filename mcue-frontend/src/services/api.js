import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Interceptor to attach JWT token to all requests
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Authentication API Endpoints
export const authAPI = {
  requestPasswordReset: (data) => API.post('/auth/password-reset-request', data),
  confirmPasswordReset: (data) => API.post('/auth/password-reset-confirm', data),
  login: (data) => API.post('/auth/login', data),
};

// Client Management API Endpoints
export const clientAPI = {
  getClients: () => API.get('/clients'),
  getClientById: (id) => API.get(`/clients/${id}`),
  createClient: (data) => API.post('/clients', data),
  updateClient: (id, data) => API.put(`/clients/${id}`, data),
  deleteClient: (id) => API.delete(`/clients/${id}`),
};

// Shoot Management API Endpoints
export const shootAPI = {
  getShoots: () => API.get('/shoots'),
  getShootById: (id) => API.get(`/shoots/${id}`),
  createShoot: (data) => API.post('/shoots', data),
  updateShoot: (id, data) => API.put(`/shoots/${id}`, data),
  completeShoot: (id, data) => API.post(`/shoots/${id}/complete`, data),
  deleteShoot: (id) => API.delete(`/shoots/${id}`),
};

export const paymentAPI = {
  getPayments: () => API.get('/payments'),
  updatePayment: (id, data) => API.put(`/payments/${id}`, data),
  sendPaymentRequest: (id) => API.post(`/payments/${id}/send`),
};

export const emailLogAPI = {
  getEmailLogs: () => API.get('/email-logs'),
};

export default API;
