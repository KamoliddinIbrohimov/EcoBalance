'use client';

import {
  QUIZ_QUESTION_TYPE,
  QUIZ_QUESTION_TYPE_LABELS_UZ,
  type CreateQuestionInput,
  type QuizOption,
  type QuizQuestionAdminDto,
  type QuizQuestionType,
} from '@eco/shared';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { ApiError } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/cn';

import { useAddQuestion, useUpdateQuestion } from '../hooks/use-quizzes';

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  question?: QuizQuestionAdminDto | null;
}

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function makeBlankOption(idx: number): QuizOption {
  return { key: KEYS[idx] ?? `OPT${idx + 1}`, textUz: '', isCorrect: idx === 0 };
}

export function QuestionFormDialog({ open, onOpenChange, quizId, question }: QuestionFormDialogProps) {
  const isEdit = !!question;
  const add = useAddQuestion(quizId);
  const update = useUpdateQuestion(quizId);

  const [type, setType] = useState<QuizQuestionType>('SINGLE_CHOICE');
  const [textUz, setTextUz] = useState('');
  const [options, setOptions] = useState<QuizOption[]>([
    makeBlankOption(0),
    makeBlankOption(1),
    makeBlankOption(2),
    makeBlankOption(3),
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(question?.type ?? 'SINGLE_CHOICE');
    setTextUz(question?.textUz ?? '');
    setOptions(
      question && question.options.length > 0
        ? question.options
        : [makeBlankOption(0), makeBlankOption(1), makeBlankOption(2), makeBlankOption(3)],
    );
    setError(null);
  }, [open, question]);

  function updateOption(idx: number, patch: Partial<QuizOption>) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  function markCorrect(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, makeBlankOption(prev.length)]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Ensure at least one option is correct.
      if (!next.some((o) => o.isCorrect) && next[0]) next[0] = { ...next[0], isCorrect: true };
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    const trimmedText = textUz.trim();
    if (trimmedText.length < 2) {
      setError('Savol matni kiritilmagan');
      return;
    }
    if (type === 'SINGLE_CHOICE') {
      if (options.some((o) => !o.textUz.trim())) {
        setError("Barcha variant matnlari to'ldirilishi kerak");
        return;
      }
      if (options.filter((o) => o.isCorrect).length !== 1) {
        setError("Aniq 1 ta to'g'ri javob belgilanishi kerak");
        return;
      }
    }

    const payload: CreateQuestionInput = {
      type,
      textUz: trimmedText,
      options: type === 'SINGLE_CHOICE' ? options.map((o) => ({ ...o, textUz: o.textUz.trim() })) : [],
    };

    try {
      if (isEdit && question) {
        await update.mutateAsync({
          questionId: question.id,
          input: {
            textUz: payload.textUz,
            options: payload.options,
          },
        });
      } else {
        await add.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    }
  }

  const busy = add.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Savolni tahrirlash' : 'Yangi savol'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Savol turi</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as QuizQuestionType)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(QUIZ_QUESTION_TYPE).map((t) => (
                  <SelectItem key={t} value={t}>
                    {QUIZ_QUESTION_TYPE_LABELS_UZ[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                Yaratilgan savol turini o'zgartirib bo'lmaydi.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="textUz">Savol matni</Label>
            <textarea
              id="textUz"
              rows={3}
              value={textUz}
              onChange={(e) => setTextUz(e.target.value)}
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Masalan: Didaktik talab nimani ifodalaydi?"
            />
          </div>

          {type === 'SINGLE_CHOICE' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variantlar (bitta to'g'ri)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={options.length >= 6}>
                  <Plus className="h-4 w-4" />
                  Variant qo'shish
                </Button>
              </div>
              <ul className="space-y-2">
                {options.map((opt, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors',
                      opt.isCorrect
                        ? 'border-primary/60 bg-primary-soft/40'
                        : 'border-border/60 bg-card',
                    )}
                  >
                    <input
                      type="radio"
                      name="correct"
                      checked={opt.isCorrect}
                      onChange={() => markCorrect(idx)}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                      title="To'g'ri javob"
                    />
                    <Input
                      value={opt.key}
                      onChange={(e) => updateOption(idx, { key: e.target.value.toUpperCase().slice(0, 2) })}
                      className="w-14 text-center font-semibold uppercase"
                      maxLength={2}
                    />
                    <Input
                      value={opt.textUz}
                      onChange={(e) => updateOption(idx, { textUz: e.target.value })}
                      placeholder="Variant matni"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeOption(idx)}
                      disabled={options.length <= 2}
                      aria-label="Variantni o'chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
              Likert shkalasida foydalanuvchi 1–5 oralig'ida bitta raqamni belgilaydi
              (1 — mutlaqo qo'shilmayman, 5 — to'liq qo'shilaman). Variantlar avtomatik ko'rinadi.
            </div>
          )}

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Saqlash' : 'Qo\'shish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
