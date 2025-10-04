import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Pools',
  description: 'Shortcut to the unified mining dashboard.',
};

export default function PoolsPage() {
  redirect('/');
}
