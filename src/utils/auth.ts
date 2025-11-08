const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_ROLE_KEY = "user_role";

export function saveTokens(accessToken: string | null, refreshToken: string | null) {
    if (accessToken === null) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
    } else {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }

    if (refreshToken === null) {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function saveUserId(userId: string | null) {
    return localStorage.setItem("user_id", userId ?? "");
}

export function getUserId(): string | null {
    const userId = localStorage.getItem("user_id");
    return userId && userId.length > 0 ? userId : null;
}

export function saveUserRole(role: string | null) {
    if (!role) {
        localStorage.removeItem(USER_ROLE_KEY);
    } else {
        localStorage.setItem(USER_ROLE_KEY, role);
    }
}

export function getUserRole(): string | null {
    const r = localStorage.getItem(USER_ROLE_KEY);
    return r && r.length > 0 ? r : null;
}

export default {
    saveTokens,
    getAccessToken,
    getRefreshToken,
    clearTokens,
    saveUserId,
    getUserId,
    saveUserRole,
    getUserRole
};
