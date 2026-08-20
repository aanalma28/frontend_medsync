/**
 * Get the current user's profile from the backend.
 *
 * Uses the centralized API wrapper which automatically:
 * 1. Attaches the in-memory JWT as Authorization: Bearer header
 * 2. Sends credentials: 'include' for the HttpOnly remember_token cookie
 * 3. On 401 → auto-refreshes the JWT via POST /auth/refresh → retries
 * 4. On refresh failure → clears auth state + redirects to /login
 *
 * This means callers don't need to handle authentication errors at all —
 * the interceptor does it transparently.
 */
import { api } from '$lib/api/api';
import { setAuth } from '$lib/stores/auth.svelte';
import { error } from '@sveltejs/kit';
import type { User } from '$lib/types';

interface ProfileResponse {
    statusCode: number;
    message: string;
    data: User;
}

export const getProfile = async (): Promise<User> => {
    const result = await api.get<ProfileResponse>('/auth/me');
    // Update the auth store with the latest user data
    // (the access token is already in memory from login or refresh)
    return result.data;
};

/**
 * Validate the current session on protected page mount.
 *
 * Flow:
 * 1. Try GET /auth/me with the in-memory JWT
 * 2. If JWT is missing/expired → api.ts auto-refreshes via cookie → retries
 * 3. If refresh also fails → api.ts redirects to /login
 * 4. On success → updates auth store with user data
 *
 * Returns the user profile for use in the component.
 */
export const validateSession = async (): Promise<User> => {
    const user = await getProfile();
    return user;
};