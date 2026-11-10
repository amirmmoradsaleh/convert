import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin/session';

export default async function AdminIndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      redirect('/admin/dashboard');
    }
  }

  redirect('/admin/login');
}
