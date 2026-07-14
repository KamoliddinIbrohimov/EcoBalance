'use client';

import { registerSchema, type RegisterInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { FormField } from '@/features/auth/components/form-field';
import { useRegister } from '@/features/auth/hooks/use-auth';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { ApiError } from '@/shared/lib/api-client';

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const register = useRegister();

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: undefined,
      password: '',
      confirmPassword: '',
    },
  });

  const rootError =
    register.error instanceof ApiError && register.error.status !== 422
      ? register.error.problem.title
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

      <form onSubmit={handleSubmit((v) => register.mutate(v))} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={t('firstNameLabel')}
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...field('firstName')}
          />
          <FormField
            label={t('lastNameLabel')}
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...field('lastName')}
          />
        </div>

        <FormField
          label={t('emailLabel')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...field('email')}
        />

        <FormField
          label={t('phoneLabel')}
          placeholder={t('phonePlaceholder')}
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...field('phone')}
        />

        <FormField
          label={t('passwordLabel')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          error={errors.password?.message}
          {...field('password')}
        />

        <FormField
          label={t('confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...field('confirmPassword')}
        />

        <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
          {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}
