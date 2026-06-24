import axios from 'axios';

/**
 * ============================
 * Axios instance
 * ============================
 */

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

/**å
 * ============================
 * Interceptors
 * ============================
 */

// Request interceptor (ex: token)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor (erros globais)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;

        if (status === 401) {
            // Exemplo: logout automático
            localStorage.removeItem('token');
            // window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

/**
 * ============================
 * REST helpers
 * ============================
 */

const get = (url, config = {}) => api.get(url, config).then((res) => res.data);

const post = (url, data = {}, config = {}) => api.post(url, data, config).then((res) => res.data);

const put = (url, data = {}, config = {}) => api.put(url, data, config).then((res) => res.data);

const patch = (url, data = {}, config = {}) => api.patch(url, data, config).then((res) => res.data);

const remove = (url, config = {}) => api.delete(url, config).then((res) => res.data);

/**
 * ============================
 * SWR fetchers
 * ============================
 */

/**
 * Uso:
 * useSWR('/users', fetcher)
 */
const fetcher = (url) => get(url);

/**
 * Uso:
 * useSWR(['/users', params], fetcherWithParams)
 */
const fetcherWithParams = ([url, params]) => get(url, { params });

/**
 * Uso:
 * useSWR(() => id ? `/users/${id}` : null, fetcher)
 */
const fetcherWithConfig = ([url, config]) => get(url, config);

/**
 * ============================
 * Export
 * ============================
 */

export { api, get, post, put, patch, remove, fetcher, fetcherWithParams, fetcherWithConfig };

export default api;
