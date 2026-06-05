import { writable } from 'svelte/store';

export interface Login {
    role: string;
    email: string;
    password: string;
    remember_me?: boolean;
}

export interface Register {
    role: string;
    name: string;
    user_code: string;
    email: string;
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
    user_code: '',
    email: '',
    password: '',
    confirm_password: '',
    accepted_terms: false
})