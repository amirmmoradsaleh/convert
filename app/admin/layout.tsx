import type { Metadata } from 'next';
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export const metadata: Metadata = {
  title: 'CMS Control Center | FileTools Admin',
  description: 'Self-hosted administration and CMS control center for Free Online File Tools.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
