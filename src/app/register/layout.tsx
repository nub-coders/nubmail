import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your NubMail account',
  description: 'Sign up for NubMail to run a full-featured email server for your custom domains.',
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
