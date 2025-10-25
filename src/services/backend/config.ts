import axios from "axios";
import {getRefreshToken} from "src/utils/auth.ts";

export const backendInstance = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL
})

backendInstance.interceptors.response.use(
    response => response,
    async (error) => {
        const originalRequest: any = error?.config;
        const status = error?.response?.status;
        const respData = error?.response?.data;
        const messageText = respData?.error;

        if (status === 401 && messageText === "Unauthorized" && !originalRequest?._retry) {
            originalRequest._retry = true;
            try {
                const refreshRes = await axios.post(
                    `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
                    {},
                    {
                        headers: {
                            "Refresh-Token": getRefreshToken()
                        }
                    }
                );

                const tokens = refreshRes?.data ?? {};
                const newAccess = tokens.access || tokens.access_token || tokens.accessToken || tokens.token;
                const newRefresh = tokens.refresh || tokens.refresh_token || tokens.refreshToken;

                if (newAccess) {
                    localStorage.setItem("access_token", newAccess);
                }
                if (newRefresh) {
                    localStorage.setItem("refresh_token", newRefresh);
                }

                if (!originalRequest.headers) originalRequest.headers = {};
                if (newAccess) originalRequest.headers.Authorization = newAccess;

                return backendInstance(originalRequest);
            } catch (refreshError) {
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);
