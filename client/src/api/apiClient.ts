import axios, { AxiosError,type InternalAxiosRequestConfig } from "axios";

const BASEURL = import.meta.env.VITE_BACKEND_URL!;

const apiClient = axios.create({
  baseURL: BASEURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// =====================
// REQUEST INTERCEPTOR
// =====================
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// =====================
// TOKEN REFRESH LOCK
// =====================
let isRefreshing = false;
let queue: ((token: string) => void)[] = [];

// =====================
// RESPONSE INTERCEPTOR
// =====================
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // prevent infinite loop
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // =====================
    // REFRESH FLOW
    // =====================
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASEURL}/auth/telegram`, {
          initData: (window as any).Telegram?.WebApp?.initData,
        });

        const token = res.data?.access_token;
        if (!token) throw new Error("Auth failed");

        localStorage.setItem("access_token", token);

        // resolve queued requests
        queue.forEach((cb) => cb(token));
        queue = [];

        isRefreshing = false;

        // retry original request
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (err) {
        isRefreshing = false;
        queue = [];
        return Promise.reject(err);
      }
    }

    // =====================
    // QUEUE REQUESTS
    // =====================
    return new Promise((resolve) => {
      queue.push((token: string) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        resolve(apiClient(originalRequest));
      });
    });
  },
);

export default apiClient;
