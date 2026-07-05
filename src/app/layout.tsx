import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AuthClientProvider from '@/lib/auth-provider';
import { IBM_Plex_Sans, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

const headlineFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-headline',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

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
      <body className={`${bodyFont.variable} ${headlineFont.variable} ${monoFont.variable} font-body antialiased`}>
        <AuthClientProvider>
          {children}
        </AuthClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
