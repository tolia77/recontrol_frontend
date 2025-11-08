import {backendInstance} from "src/services/backend/config.ts";
import {getAccessToken, getRefreshToken} from "src/utils/auth.ts";

export async function loginRequest(email: string, password: string) {
    return await backendInstance.post("/auth/login", {
        email: email,
        password: password
    })
}

export async function registerRequest(username: string, email: string, password: string) {
    return await backendInstance.post("/auth/register", {
        user: {
            username: username,
            email: email,
            password: password
        }
    })
}

export async function refreshTokenRequest() {
    return await backendInstance.post("/auth/refresh", {}, {
        headers: {
            "Refresh-Token": getRefreshToken()
        }
    })

}

export async function logoutRequest() {
    return await backendInstance.post("/auth/logout", {}, {
        headers: {
            Authorization: getAccessToken(),
            "Refresh-Token": getRefreshToken()
        }
    });
}
