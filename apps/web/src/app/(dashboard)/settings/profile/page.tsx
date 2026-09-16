'use client';

import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  Key,
  Loader2,
  Mail,
  Phone,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useChangePassword,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/use-profile';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
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
import { useAuthStore } from '@/shared/stores/auth-store';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const rolesT = useTranslations('roles');

  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const changePassword = useChangePassword();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: null,
      locale: (user?.locale as UpdateProfileInput['locale']) ?? 'uz',
    },
  });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const profileErr = updateProfile.error as ApiError | undefined;
  const avatarErr = uploadAvatar.error as ApiError | undefined;
  const pwdErr = changePassword.error as ApiError | undefined;

  if (!user) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Foydalanuvchi ma&apos;lumotlari yuklanmoqda…
      </Card>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  function handleAvatarPicked(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Faqat rasm yuklash mumkin (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Rasm 5 MB dan katta bo‘lmasligi kerak.');
      return;
    }
    uploadAvatar.mutate(file);
  }

  const onSubmitProfile = handleSubmit((values) => {
    updateProfile.mutate(values, {
      onSuccess: () => reset(values, { keepValues: true }),
    });
  });

  const onSubmitPwd = handleSubmitPwd((values) => {
    setPasswordSuccess(false);
    changePassword.mutate(values, {
      onSuccess: () => {
        setPasswordSuccess(true);
        resetPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      },
    });
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <UserIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mening profilim</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Shaxsiy ma&apos;lumotlarni ko&apos;rish va tahrirlash.
          </p>
        </div>
      </div>

      {/* Avatar + summary */}
      <Card className="p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold">{initials || <UserIcon />}</span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              {user.firstName} {user.lastName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="default" className="gap-1">
                <Shield className="h-3.5 w-3.5" />
                {(() => {
                  try {
                    return rolesT(user.roles[0] as Parameters<typeof rolesT>[0]);
                  } catch {
                    return user.roles[0];
                  }
                })()}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Faol
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </span>
              {user.organization ? (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {user.organization.nameUz}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPicked}
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
              variant="outline"
              size="sm"
            >
              {uploadAvatar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Rasmni almashtirish
            </Button>
            {user.avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAvatar.mutate()}
                disabled={removeAvatar.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Rasmni o&apos;chirish
              </Button>
            ) : null}
          </div>
        </div>

        {avatarError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{avatarError}</AlertDescription>
          </Alert>
        ) : null}
        {avatarErr ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{avatarErr.message}</AlertDescription>
          </Alert>
        ) : null}
      </Card>

      {/* Editable profile info */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          Shaxsiy ma&apos;lumotlar
        </h2>

        {profileErr ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{profileErr.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmitProfile} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Ism</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName ? (
                <p className="text-xs font-medium text-destructive">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Familiya</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName ? (
                <p className="text-xs font-medium text-destructive">{errors.lastName.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefon
              </Label>
              <Input
                id="phone"
                placeholder="+998 90 123 45 67"
                {...register('phone')}
              />
              {errors.phone ? (
                <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Til</Label>
              <Select
                value={watch('locale')}
                onValueChange={(v) => setValue('locale', v as UpdateProfileInput['locale'], { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uz">O&apos;zbekcha</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <Input value={user.email} disabled readOnly />
            <p className="text-[11px] text-muted-foreground">
              Email o&apos;zgartirish uchun administratorga murojaat qiling.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Saqlash
            </Button>
          </div>
        </form>
      </Card>

      {/* Change password */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Key className="h-4 w-4" />
          Parolni o&apos;zgartirish
        </h2>

        {passwordSuccess ? (
          <Alert className="mb-4 border-primary/40 bg-primary/5">
            <AlertDescription className="text-primary">
              Parol muvaffaqiyatli yangilandi. Xavfsizlik uchun barcha sessiyalar bekor qilindi —
              qayta login qilishingiz kerak bo&apos;lishi mumkin.
            </AlertDescription>
          </Alert>
        ) : null}

        {pwdErr ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{pwdErr.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmitPwd} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Joriy parol</Label>
            <Input id="currentPassword" type="password" {...registerPwd('currentPassword')} />
            {pwdErrors.currentPassword ? (
              <p className="text-xs font-medium text-destructive">
                {pwdErrors.currentPassword.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Yangi parol</Label>
              <Input id="newPassword" type="password" {...registerPwd('newPassword')} />
              {pwdErrors.newPassword ? (
                <p className="text-xs font-medium text-destructive">
                  {pwdErrors.newPassword.message}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Kamida 10 belgi, katta va kichik harflar hamda raqam.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Yangi parolni tasdiqlang</Label>
              <Input id="confirmPassword" type="password" {...registerPwd('confirmPassword')} />
              {pwdErrors.confirmPassword ? (
                <p className="text-xs font-medium text-destructive">
                  {pwdErrors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Parolni yangilash
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
