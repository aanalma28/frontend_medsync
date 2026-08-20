import { writable } from 'svelte/store';

/**
 * User profile returned by the backend.
 * Used across the auth store, API responses, and dashboard components.
 */
export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
    birth_date?: string;
    createdAt?: string;
    staff_code?: string;
    medical_record_number?: string;
}

export interface Login {
    role: string;
    email: string;
    password: string;
    remember_me?: boolean;
}

export interface Register {
    role: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    birth_date: string;
    password: string;
    confirm_password: string;
    accepted_terms: boolean;
}

// svelte store variables
export const LoginData = writable<Login>({
    role: 'pasien',
    email: '',
    password: '',
    remember_me: false
})

export const RegisterData = writable<Register>({
    role: 'pasien',
    name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    password: '',
    confirm_password: '',
    accepted_terms: false
})