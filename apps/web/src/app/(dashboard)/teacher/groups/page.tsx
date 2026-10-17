import { redirect } from 'next/navigation';

// Eski URL — guruhlar endi barcha rollar uchun /groups sahifasida.
export default function TeacherGroupsRedirect() {
  redirect('/groups');
}
