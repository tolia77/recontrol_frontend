const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_ROLE_KEY = 'user_role';
const USER_ID_KEY = 'user_id';

/**
 * Save authentication tokens to localStorage
 */
export function saveTokens(accessToken: string | null, refreshToken: string | null): void {
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

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Clear all auth tokens
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Save user ID to localStorage
 */
export function saveUserId(userId: string | null): void {
  if (userId === null || userId === '') {
    localStorage.removeItem(USER_ID_KEY);
  } else {
    localStorage.setItem(USER_ID_KEY, userId);
  }
}

/**
 * Get user ID from localStorage
 */
export function getUserId(): string | null {
  const userId = localStorage.getItem(USER_ID_KEY);
  return userId && userId.length > 0 ? userId : null;
}

/**
 * Save user role to localStorage
 */
export function saveUserRole(role: string | null): void {
  if (!role) {
    localStorage.removeItem(USER_ROLE_KEY);
  } else {
    localStorage.setItem(USER_ROLE_KEY, role);
  }
}

/**
 * Get user role from localStorage
 */
export function getUserRole(): string | null {
  const role = localStorage.getItem(USER_ROLE_KEY);
  return role && role.length > 0 ? role : null;
}

/**
 * Check if user is authenticated (has access token)
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Clear all auth data (tokens, user ID, role)
 */
export function clearAuth(): void {
  clearTokens();
  saveUserId(null);
  saveUserRole(null);
}
