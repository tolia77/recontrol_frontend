import axios from "axios";

export const backendInstance = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL
})