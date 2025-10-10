import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AuthClientProvider from '@/lib/auth-provider';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'NubMail - Email Server Management',
  description: 'A full-featured email server management system for custom domains.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize default email accounts on startup (client side)
  // Only runs once per session, safe for idempotent setup
  if (typeof window !== 'undefined') {
    import('@/lib/init-email-accounts').then(mod => {
      const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN || '';
      mod.initEmailAccounts(domain);
    });
    import('@/lib/verify-admins').then(mod => {
      mod.verifyAdminUsers();
    });
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <AuthClientProvider>
          {children}
        </AuthClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
