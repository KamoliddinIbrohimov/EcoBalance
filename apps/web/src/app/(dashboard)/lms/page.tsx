import { redirect } from 'next/navigation';

// Eski URL — 3-rol LMS'da bu bo'lim /learning sahifasiga ko'chdi.
export default function LmsRedirect() {
  redirect('/learning');
}
