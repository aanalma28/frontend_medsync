/**
 * API Wrapper — Centralized fetch client with automatic JWT injection and 401 auto-refresh.
 *
 * Architecture:
 * 1. REQUEST INTERCEPTOR: Reads in-memory JWT → attaches Authorization: Bearer header
 * 2. CREDENTIALS: Always sends `credentials: 'include'` so the browser attaches
 *    the HttpOnly `remember_token` cookie automatically
 * 3. RESPONSE INTERCEPTOR: On 401 → calls POST /auth/refresh → updates memory JWT → retries
 * 4. MUTEX LOCK: Prevents parallel refresh storms — only one refresh at a time,
 *    subsequent 401s queue up and replay with the new token
 * 5. CSRF: Reads `csrf_token` cookie and sends it as `X-CSRF-Token` header on mutating requests
 *
 * Usage:
 *   import { api } from '$lib/api/api';
 *   const data = await api.get('/auth/me');
 *   await api.post('/appointments', { doctor_id: '...', date: '...' });
 */

import { browser } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { getAccessToken, setAuth, clearAuth } from '$lib/stores/auth.svelte';
import type { User } from '$lib/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Refresh Mutex ───────────────────────────────────────────────────────────
// Prevents multiple parallel refresh calls when several requests hit 401 simultaneously.
// The first 401 triggers the refresh; subsequent ones wait for the same promise.
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Read a non-HttpOnly cookie value by name.
 * Used to read the `csrf_token` cookie for the double-submit CSRF pattern.
 */
function readCookie(name: string): string {
	if (!browser || typeof document === 'undefined') return '';
	const match = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`));
	return match ? decodeURIComponent(match.substring(name.length + 1)) : '';
}

/**
 * Build request headers with JWT + CSRF token injection.
 *
 * @param method - HTTP method (determines whether CSRF token is attached)
 * @param customHeaders - Additional headers from the caller
 */
function buildHeaders(method: string, customHeaders?: HeadersInit): Headers {
	const headers = new Headers(customHeaders);

	// Always set JSON content type unless caller explicitly set something else
	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	// Inject Bearer token from memory (if available)
	const token = getAccessToken();
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	// Inject CSRF token on mutating methods (double-submit cookie pattern)
	const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
	if (mutatingMethods.includes(method.toUpperCase())) {
		const csrfToken = readCookie('csrf_token');
		if (csrfToken) {
			headers.set('X-CSRF-Token', csrfToken);
		}
	}

	return headers;
}

/**
 * Attempt to refresh the JWT using the HttpOnly `remember_token` cookie.
 * The cookie is sent automatically by the browser (credentials: 'include').
 *
 * Returns `true` if refresh succeeded and in-memory token was updated.
 * Returns `false` if refresh failed (cookie expired/invalid/absent).
 */
async function attemptRefresh(): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			clearAuth();
			return false;
		}

		const result = await response.json();
		const { accessToken, user } = result.data as { accessToken: string; user: User };

		setAuth(accessToken, user);
		return true;
	} catch {
		clearAuth();
		return false;
	}
}

/**
 * Thread-safe refresh with mutex locking.
 * If a refresh is already in progress, returns the existing promise.
 * This prevents N parallel refresh requests when N requests hit 401 simultaneously.
 */
function refreshWithMutex(): Promise<boolean> {
	if (isRefreshing && refreshPromise) {
		return refreshPromise;
	}

	isRefreshing = true;
	refreshPromise = attemptRefresh().finally(() => {
		isRefreshing = false;
		refreshPromise = null;
	});

	return refreshPromise;
}

/**
 * Core fetch function with interceptor logic.
 *
 * Flow:
 * 1. Build headers (JWT + CSRF)
 * 2. Execute fetch with credentials: 'include'
 * 3. If 401 → attempt refresh → retry original request
 * 4. If refresh fails → clear auth + redirect to /login
 * 5. Parse JSON response
 *
 * @param path - API path (e.g., '/auth/me') — will be prefixed with API_BASE
 * @param options - Standard fetch RequestInit options
 * @returns Parsed JSON response
 */
async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
	const method = (options.method || 'GET').toUpperCase();
	const url = `${API_BASE}${path}`;

	const headers = buildHeaders(method, options.headers as HeadersInit);

	const fetchOptions: RequestInit = {
		...options,
		method,
		headers,
		credentials: 'include', // Always send cookies (remember_token, csrf_token)
	};

	let response = await fetch(url, fetchOptions);

	// ─── 401 Interceptor: Auto-Refresh ─────────────────────────────────────────
	if (response.status === 401) {
		const refreshed = await refreshWithMutex();

		if (refreshed) {
			// Retry the original request with the new token
			const retryHeaders = buildHeaders(method, options.headers as HeadersInit);
			const retryOptions: RequestInit = {
				...options,
				method,
				headers: retryHeaders,
				credentials: 'include',
			};

			response = await fetch(url, retryOptions);
		} else {
			// Refresh failed — session is truly expired
			if (browser) {
				goto('/login');
			}
			throw new Error('Session expired. Please login again.');
		}
	}

	// Parse the response
	const data = await response.json();

	if (!response.ok) {
		// Throw a structured error so callers can catch and display backend messages
		const error = new Error(data.message || `Request failed with status ${response.status}`);
		(error as any).statusCode = response.status;
		(error as any).response = data;
		throw error;
	}

	return data as T;
}

// ─── Convenience Methods ─────────────────────────────────────────────────────

export const api = {
	/**
	 * GET request.
	 * @example const profile = await api.get('/auth/me');
	 */
	get<T = unknown>(path: string, options?: RequestInit): Promise<T> {
		return request<T>(path, { ...options, method: 'GET' });
	},

	/**
	 * POST request with JSON body.
	 * @example await api.post('/auth/login', { email, password, role });
	 */
	post<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
		return request<T>(path, {
			...options,
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined,
		});
	},

	/**
	 * PUT request with JSON body.
	 */
	put<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
		return request<T>(path, {
			...options,
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined,
		});
	},

	/**
	 * PATCH request with JSON body.
	 */
	patch<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
		return request<T>(path, {
			...options,
			method: 'PATCH',
			body: body ? JSON.stringify(body) : undefined,
		});
	},

	/**
	 * DELETE request.
	 */
	delete<T = unknown>(path: string, options?: RequestInit): Promise<T> {
		return request<T>(path, { ...options, method: 'DELETE' });
	},
};
