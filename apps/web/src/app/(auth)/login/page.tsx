'use client';

import { loginSchema, type LoginInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { useLogin } from '@/features/auth/hooks/use-auth';
import { FormField } from '@/features/auth/components/form-field';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { ApiError } from '@/shared/lib/api-client';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  const rootError =
    login.error instanceof ApiError && login.error.status !== 422
      ? login.error.problem.title || t('invalidCredentials')
      : null;

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {rootError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label={t('emailLabel')}
          placeholder={t('emailPlaceholder')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('forgotLink')}
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t('registerLink')}
        </Link>
      </p>
    </div>
  );
}
