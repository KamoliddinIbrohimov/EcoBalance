import { BadRequestException } from '@nestjs/common';
import type { QuizOption, SubmissionAnswerInput } from '@eco/shared';

export interface GradableQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'LIKERT_5';
  options: QuizOption[];
}

export interface ScoreResult {
  scoreTotal: number | null;
  scoreMax: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  likertSum: number | null;
  likertMax: number | null;
  /** Saqlanadigan, normallashtirilgan javoblar (javobsiz savollar tashlanadi). */
  answers: { questionId: string; value: string }[];
}

export const LIKERT_MAX_PER_QUESTION = 5;

/**
 * Sof baholash. SINGLE_CHOICE — 1 ball (javobsiz = 0, lekin scoreMax'ga
 * kiradi); LIKERT_5 — ballanmaydi, faqat likertSum'ga qo'shiladi.
 * Ballanadigan savol bo'lmasa score/passed null (so'rovnoma), Likert
 * bo'lmasa likert maydonlari null.
 */
export function scoreSubmission(
  questions: GradableQuestion[],
  input: SubmissionAnswerInput[],
  passPercent: number,
): ScoreResult {
  if (questions.length === 0) throw new BadRequestException('Testda savollar yo‘q');

  const known = new Set(questions.map((q) => q.id));
  const given = new Map<string, string>();
  for (const a of input) {
    if (!known.has(a.questionId)) throw new BadRequestException(`Noma'lum questionId: ${a.questionId}`);
    if (given.has(a.questionId)) throw new BadRequestException(`Savolga takroriy javob: ${a.questionId}`);
    given.set(a.questionId, a.value.trim());
  }

  let scoreTotal = 0;
  let scoreMax = 0;
  let likertSum = 0;
  let likertMax = 0;
  const answers: ScoreResult['answers'] = [];

  for (const q of questions) {
    const raw = given.get(q.id);
    if (q.type === 'SINGLE_CHOICE') {
      scoreMax += 1;
      if (!raw) continue;
      const value = raw.toUpperCase();
      const chosen = q.options.find((o) => o.key.toUpperCase() === value);
      if (!chosen) throw new BadRequestException(`Savol ${q.id}: variant topilmadi (${value})`);
      if (chosen.isCorrect) scoreTotal += 1;
      answers.push({ questionId: q.id, value });
    } else {
      likertMax += LIKERT_MAX_PER_QUESTION;
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > LIKERT_MAX_PER_QUESTION) {
        throw new BadRequestException(`Savol ${q.id}: Likert qiymati 1..5 oralig‘ida bo‘lishi kerak`);
      }
      likertSum += n;
      answers.push({ questionId: q.id, value: String(n) });
    }
  }

  const scored = scoreMax > 0;
  const scorePercent = scored ? Math.round((scoreTotal / scoreMax) * 100) : null;
  return {
    scoreTotal: scored ? scoreTotal : null,
    scoreMax: scored ? scoreMax : null,
    scorePercent,
    passed: scorePercent === null ? null : scorePercent >= passPercent,
    likertSum: likertMax > 0 ? likertSum : null,
    likertMax: likertMax > 0 ? likertMax : null,
    answers,
  };
}
