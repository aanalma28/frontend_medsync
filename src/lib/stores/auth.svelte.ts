/**
 * Auth Store — In-memory JWT storage using Svelte 5 $state runes.
 *
 * SECURITY: The access token is stored STRICTLY in memory (JavaScript variable).
 * The access token and CSRF token are never written to persistent browser storage.
 * This eliminates XSS-based token theft from persistent browser storage.
 *
 * The remember_me opaque token lives as an HttpOnly cookie (set by the backend)
 * and is automatically sent by the browser with `credentials: 'include'`.
 * The frontend never reads or writes this cookie — it's invisible to JavaScript.
 *
 * Lifecycle:
 * - Login → setAuth(token, csrfToken, user) → stored in memory
 * - Page reload → tokens lost → recovered via POST /auth/refresh (cookie)
 * - Logout → clearAuth() → memory wiped, backend clears cookies
 * - Tab close → memory freed → session recovered on next visit via cookie
 */

import type { AuthResponse, Login, Register, User } from '$lib/types';
import { api } from '$lib/api/api';

/**
 * Reactive auth state using Svelte 5 runes.
 * All components that reference these properties will re-render on change.
 */
let accessToken = $state<string | null>(null);
let csrfToken = $state<string | null>(null);
let user = $state<User | null>(null);
let isLoading = $state<boolean>(true);

/**
 * Derived authentication check.
 * A user is considered authenticated if both the token and user object exist.
 */
let isAuthenticated = $derived<boolean>(!!accessToken && !!user);

/**
 * Set auth state after successful login or token refresh.
 * @param token - The JWT access token from the backend JSON response
 * @param userData - The user profile object from the backend
 */
function setAuth(token: string, csrfTokenValue: string, userData: User): void {
	accessToken = token;
	csrfToken = csrfTokenValue;
	user = userData;
	isLoading = false;
}

/**
 * Clear all auth state — used on logout or when refresh fails.
 * Does NOT clear cookies (that's the backend's job via POST /auth/logout).
 */
function clearAuth(): void {
	accessToken = null;
	csrfToken = null;
	user = null;
	isLoading = false;
}

/**
 * Get the current in-memory access token.
 * Used by the API wrapper to attach the Authorization header.
 * Returns null if no token is stored (user not logged in or page just loaded).
 */
function getAccessToken(): string | null {
	return accessToken;
}

/**
 * Get the current in-memory CSRF token for mutating API requests.
 */
function getCsrfToken(): string | null {
	return csrfToken;
}

/**
 * Set the loading state — used during initial session validation on page mount.
 */
function setLoading(loading: boolean): void {
	isLoading = loading;
}

/**
 * Authenticate a user and store the returned access token in memory.
 */
async function login(credentials: Login): Promise<User> {
	const result = await api.post<AuthResponse>('/auth/login', credentials);
	const authData = result?.data;
	const accessToken = authData?.accessToken;
	const csrfTokenValue = authData?.csrfToken;
	const userData = authData?.user;

	if (
		typeof accessToken !== 'string' ||
		!accessToken ||
		typeof csrfTokenValue !== 'string' ||
		!csrfTokenValue ||
		typeof userData !== 'object' ||
		userData === null
	) {
		throw new Error('Login response did not include a valid access token, CSRF token, and user.');
	}

	setAuth(accessToken, csrfTokenValue, userData);
	return userData;
}

/**
 * Register a new patient account.
 */
async function register(data: Register): Promise<void> {
	await api.post('/auth/register', data);
}

/**
 * Export a reactive auth state object.
 * Components can import and use: `authState.isAuthenticated`, `authState.user`, etc.
 */
export const authState = {
	get accessToken() {
		return accessToken;
	},
	get csrfToken() {
		return csrfToken;
	},
	get user() {
		return user;
	},
	get isAuthenticated() {
		return isAuthenticated;
	},
	get isLoading() {
		return isLoading;
	}
};

export { setAuth, clearAuth, getAccessToken, getCsrfToken, setLoading, login, register };
