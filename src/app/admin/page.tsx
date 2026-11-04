import type { Metadata } from 'next';
import Admin from '@/components/Admin';

export const metadata: Metadata = { title: 'Admin desk · Top 10', robots: { index: false } };

export default function AdminPage() {
  return <Admin />;
}
