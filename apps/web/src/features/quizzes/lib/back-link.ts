import type { QuizPublicDetailDto } from '@eco/shared';

/**
 * Testdan qaytish manzili: darsga biriktirilgan test — o'sha dars sahifasiga,
 * mustaqil test — "Ekologik testlar" ro'yxatiga.
 */
export function quizBackLink(quiz: Pick<QuizPublicDetailDto, 'lesson'>): { href: string; label: string } {
  if (quiz.lesson) {
    return {
      href: `/learning/${quiz.lesson.course.slug}/${quiz.lesson.id}`,
      label: quiz.lesson.course.nameUz,
    };
  }
  return { href: '/monitoring/tests', label: 'Ekologik testlar' };
}
