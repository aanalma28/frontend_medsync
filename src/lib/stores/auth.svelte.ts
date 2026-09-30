/**
 * Auth Store — In-memory JWT storage using Svelte 5 $state runes.
 *
 * SECURITY: The access token is stored STRICTLY in memory (JavaScript variable).
 * It is never written to localStorage, sessionStorage, or cookies.
 * This eliminates XSS-based token theft from persistent browser storage.
 *
 * The remember_me opaque token lives as an HttpOnly cookie (set by the backend)
 * and is automatically sent by the browser with `credentials: 'include'`.
 * The frontend never reads or writes this cookie — it's invisible to JavaScript.
 *
 * Lifecycle:
 * - Login → setAuth(token, user) → stored in memory
 * - Page reload → JWT lost → auto-recovered via POST /auth/refresh (cookie)
 * - Logout → clearAuth() → memory wiped, backend clears cookie
 * - Tab close → memory freed → session recovered on next visit via cookie
 */

import type { User } from '$lib/types';

/**
 * Reactive auth state using Svelte 5 runes.
 * All components that reference these properties will re-render on change.
 */
let accessToken = $state<string | null>(null);
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
function setAuth(token: string, userData: User): void {
	accessToken = token;
	user = userData;
	isLoading = false;
}

/**
 * Clear all auth state — used on logout or when refresh fails.
 * Does NOT clear cookies (that's the backend's job via POST /auth/logout).
 */
function clearAuth(): void {
	accessToken = null;
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
 * Set the loading state — used during initial session validation on page mount.
 */
function setLoading(loading: boolean): void {
	isLoading = loading;
}

/**
 * Export a reactive auth state object.
 * Components can import and use: `authState.isAuthenticated`, `authState.user`, etc.
 */
export const authState = {
	get accessToken() { return accessToken; },
	get user() { return user; },
	get isAuthenticated() { return isAuthenticated; },
	get isLoading() { return isLoading; },
};

export { setAuth, clearAuth, getAccessToken, setLoading };
