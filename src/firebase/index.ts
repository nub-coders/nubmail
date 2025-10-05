'use client';

// Firebase has been removed from this project. Use the new AuthClientProvider and server APIs instead.

export function initializeFirebase() {
  throw new Error('Firebase removed. Use /api/auth endpoints and AuthClientProvider.');
}

export const useFirebase = () => {
  throw new Error('Firebase removed. Use AuthClientProvider (useAuthClient) and server APIs.');
};

export const useAuth = () => {
  throw new Error('Firebase removed. Use AuthClientProvider (useAuthClient) and server APIs.');
};

export const useUser = () => {
  throw new Error('Firebase removed. Use AuthClientProvider (useAuthClient) and server APIs.');
};

export const getSdks = () => {
  throw new Error('Firebase removed.');
};
