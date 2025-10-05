'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Prefer explicitly using the firebaseConfig in client environments where network
    // requests are executed from the browser. Some hosting environments inject config
    // automatically when calling initializeApp() without args, but that can fail and
    // lead to runtime network errors. To be robust, prefer firebaseConfig on the client.
    let firebaseApp;

    try {
      if (typeof window !== 'undefined') {
        // Running in the browser — initialize with the explicit config
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        // Server/SSR environment — attempt default initialization first
        firebaseApp = initializeApp();
      }
    } catch (e) {
      // If initialization without args failed (common in dev), fall back to explicit config
      try {
        firebaseApp = initializeApp(firebaseConfig);
      } catch (err) {
        // If this still fails, rethrow the original error for visibility
        console.error('Failed to initialize Firebase with both automatic and explicit config:', e, err);
        throw err;
      }
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
