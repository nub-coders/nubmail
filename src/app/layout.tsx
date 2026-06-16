import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AuthClientProvider from '@/lib/auth-provider';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'NubMail - Email Server Management',
  description: 'NubMail is a full-featured email server management system for custom domains. Send, receive, and manage emails with your own domain.',
  metadataBase: new URL('https://mails.nubcoder.com'),
  applicationName: 'NubMail',
  authors: [{ name: 'NubCoder', url: 'https://nubcoder.com' }],
  creator: 'NubCoder',
  publisher: 'NubCoder',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'NubMail - Email Server Management',
    description: 'Professional email server management for custom domains. Built-in SMTP, DKIM signing, and API access included.',
    url: 'https://mails.nubcoder.com',
    siteName: 'NubMail',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
