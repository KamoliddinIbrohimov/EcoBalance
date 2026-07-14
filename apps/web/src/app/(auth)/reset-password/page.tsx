'use client';

import { resetPasswordSchema, type ResetPasswordInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/features/auth/components/form-field';
import { useResetPassword } from '@/features/auth/hooks/use-auth';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

function ResetPasswordForm() {
  const t = useTranslations('auth.reset');
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {reset.isSuccess ? (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('success')}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit((v) => reset.mutate(v))} className="space-y-4" noValidate>
        <input type="hidden" {...register('token')} />

        <FormField
          label={t('passwordLabel')}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <FormField
          label={t('confirmLabel')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
