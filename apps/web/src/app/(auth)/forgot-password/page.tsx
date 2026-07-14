'use client';

import { forgotPasswordSchema, type ForgotPasswordInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { FormField } from '@/features/auth/components/form-field';
import { useForgotPassword } from '@/features/auth/hooks/use-auth';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot');
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {forgot.isSuccess ? (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('sent')}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit((v) => forgot.mutate(v))} className="space-y-4" noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" size="lg" className="w-full" disabled={forgot.isPending}>
          {forgot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}
