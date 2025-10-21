import {backendInstance} from "src/services/backend/config.ts";

export async function loginRequest(email: string, password: string) {
    return await backendInstance.post("/auth/login", {
        email: email,
        password: password
    }, {
        withCredentials: true
    })
}

export async function registerRequest(username: string, email: string, password: string) {
    return await backendInstance.post("/auth/register", {
        user: {
            username: username,
            email: email,
            password: password
        }
    }, {
        withCredentials: true
    })
}