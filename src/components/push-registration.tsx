'use client';

import { useEffect } from 'react';
import { useAuthClient } from '@/lib/auth-provider';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

function toApplicationServerKey(base64Url: string): BufferSource {
  return base64UrlToUint8Array(base64Url) as unknown as BufferSource;
}

export function PushRegistration() {
  const { user } = useAuthClient();

  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    let isCancelled = false;

    const registerPush = async () => {
      try {
        const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
        if (!keyRes.ok) return;
        const keyData = await keyRes.json();
        const publicKey = (keyData?.publicKey || '').trim();
        if (!publicKey) return;

        const registration = await navigator.serviceWorker.register('/sw.js');
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          let permission = Notification.permission;
          if (permission === 'default') {
            permission = await Notification.requestPermission();
          }
          if (permission !== 'granted') return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toApplicationServerKey(publicKey),
          });
        }

        if (isCancelled) return;

        await fetch('/api/push/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });
      } catch (err) {
        console.warn('Push registration failed', err);
      }
    };

    registerPush();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  return null;
}
