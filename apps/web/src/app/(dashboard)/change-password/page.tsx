'use client';

import { changePasswordSchema, type ChangePasswordInput } from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { FormField } from '@/features/auth/components/form-field';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ApiError, apiClient, refreshAuthSession } from '@/shared/lib/api-client';
import { getRoleHomePath } from '@/shared/lib/role-path';
import { useAuthStore } from '@/shared/stores/auth-store';

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const forced = !!user?.mustChangePassword;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mut = useMutation({
    mutationFn: async (values: ChangePasswordInput) => {
      await apiClient.post('/auth/me/change-password', values);
    },
    onSuccess: async () => {
      await refreshAuthSession();
      const next = user ? getRoleHomePath(user.roles) : '/';
      router.replace(next);
    },
  });

  const onSubmit = handleSubmit((values) => mut.mutate(values));

  const rootError =
    mut.error instanceof ApiError
      ? mut.error.problem.title || 'Parolni almashtirib bo‘lmadi'
      : null;

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Parolni almashtirish
          </h1>
          {forced ? (
            <p className="mt-1 text-sm text-warning">
              Birinchi kirish — davom etish uchun vaqtincha parolingizni almashtirishingiz kerak.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Parolingiz kamida 10 ta belgi, katta/kichik harf va raqam bo‘lishi kerak.
            </p>
          )}
        </header>

        {rootError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            label="Joriy parol"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <FormField
            label="Yangi parol"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <FormField
            label="Yangi parolni takrorlang"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" size="lg" className="w-full" disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Parolni almashtirish
          </Button>
        </form>
      </Card>
    </div>
  );
}
