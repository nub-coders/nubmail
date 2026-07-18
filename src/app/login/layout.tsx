import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in to NubMail',
  description: 'Sign in to your NubMail account to manage your email server, domains, and accounts.',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
