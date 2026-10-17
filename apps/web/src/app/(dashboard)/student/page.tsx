import { redirect } from 'next/navigation';

// Eski URL — talaba bosh sahifasi /home'ga ko'chdi.
export default function StudentRedirect() {
  redirect('/home');
}
