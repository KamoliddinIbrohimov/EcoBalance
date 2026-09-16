'use client';

import { createUserSchema, updateUserSchema, type AdminUserDto } from '@eco/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';

import { flattenTree, useOrganizationsTree } from '@/features/organizations/hooks/use-organizations';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
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

import { useCreateUser, useRolesOptions, useUpdateUser } from '../hooks/use-users';

const NO_ORG = '__none__';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  organizationId: string;
  roleSlugs: string[];
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  organizationId: '',
  roleSlugs: [],
  isActive: true,
};

function collectFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUserDto | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = !!user;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: roles } = useRolesOptions();
  const { data: tree } = useOrganizationsTree();
  const create = useCreateUser();
  const update = useUpdateUser();
  const pending = create.isPending || update.isPending;
  const mutationError = (create.error ?? update.error) as ApiError | undefined;

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setForm(
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone ?? '',
            password: '',
            organizationId: user.organizationId ?? '',
            roleSlugs: [...user.roles],
            isActive: user.isActive,
          }
        : EMPTY_FORM,
    );
  }, [open, user]);

  const flatOrgs = tree ? flattenTree(tree) : [];

  function toggleRole(slug: string) {
    setForm((f) => ({
      ...f,
      roleSlugs: f.roleSlugs.includes(slug)
        ? f.roleSlugs.filter((s) => s !== slug)
        : [...f.roleSlugs, slug],
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    if (isEdit && user) {
      const result = updateUserSchema.safeParse({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        organizationId: form.organizationId || null,
        roleSlugs: form.roleSlugs,
        isActive: form.isActive,
      });
      if (!result.success) {
        setFieldErrors(collectFieldErrors(result.error));
        return;
      }
      update.mutate(
        { id: user.id, input: result.data },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    const result = createUserSchema.safeParse({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || null,
      password: form.password,
      organizationId: form.organizationId || null,
      roleSlugs: form.roleSlugs,
      isActive: form.isActive,
    });
    if (!result.success) {
      setFieldErrors(collectFieldErrors(result.error));
      return;
    }
    create.mutate(result.data, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Foydalanuvchini tahrirlash' : "Yangi foydalanuvchi qo'shish"}</DialogTitle>
        </DialogHeader>

        {mutationError ? (
          <Alert variant="destructive">
            <AlertDescription>{mutationError.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-first-name">Ism</Label>
              <Input
                id="user-first-name"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
              {fieldErrors.firstName ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.firstName}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-last-name">Familiya</Label>
              <Input
                id="user-last-name"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
              {fieldErrors.lastName ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.lastName}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                disabled={isEdit}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              {isEdit ? (
                <p className="text-xs text-muted-foreground">Email keyinchalik o'zgartirilmaydi</p>
              ) : fieldErrors.email ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-phone">Telefon (ixtiyoriy)</Label>
              <Input
                id="user-phone"
                placeholder="+998901234567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              {fieldErrors.phone ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.phone}</p>
              ) : null}
            </div>
          </div>

          {!isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Parol</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Kamida 10 belgi: katta harf, kichik harf va raqam
              </p>
              {fieldErrors.password ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.password}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Tashkilot (ixtiyoriy)</Label>
            <Select
              value={form.organizationId || NO_ORG}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, organizationId: v === NO_ORG ? '' : v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ORG}>— Biriktirilmagan —</SelectItem>
                {flatOrgs.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {'—'.repeat(opt.depth)} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rollar</Label>
            <div className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
              {(roles ?? []).map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={form.roleSlugs.includes(role.slug)}
                    onCheckedChange={() => toggleRole(role.slug)}
                  />
                  {role.nameUz}
                </label>
              ))}
            </div>
            {fieldErrors.roleSlugs ? (
              <p className="text-xs font-medium text-destructive">{fieldErrors.roleSlugs}</p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isActive: checked === true }))
              }
            />
            Faol foydalanuvchi
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
