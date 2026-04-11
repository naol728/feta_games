/*eslint-disable*/
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASEURL = import.meta.env.VITE_BACKEND_URL!;

const apiClient = axios.create({
  baseURL: BASEURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue: ((token: string) => void)[] = [];

const normalizeError = (error: AxiosError) => {
  const message =
    (error.response?.data as any)?.message ||
    error.message ||
    "Something went wrong";

  const status = error.response?.status || 500;

  return { message, status };
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (error.response?.status !== 401) {
      return Promise.reject(normalizeError(error));
    }
    if (originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }
    originalRequest._retry = true;
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const res = await axios.post(`${BASEURL}/auth/telegram`, {
          initData: window.Telegram?.WebApp?.initData,
        });

        const token = res.data?.access_token;
        if (!token) throw new Error("Auth failed");

        localStorage.setItem("access_token", token);

        queue.forEach((cb) => cb(token));
        queue = [];

        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (err: any) {
        isRefreshing = false;
        queue = [];

        return Promise.reject(normalizeError(err as AxiosError));
      }
    }

    return new Promise((resolve) => {
      queue.push((token: string) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        resolve(apiClient(originalRequest));
      });
    });
  },
);

export default apiClient;
