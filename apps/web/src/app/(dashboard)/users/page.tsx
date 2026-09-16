'use client';

import { PERMISSION, ROLE, ROLE_LABELS_UZ, type AdminUserDto, type Role } from '@eco/shared';
import { Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { flattenTree, useOrganizationsTree } from '@/features/organizations/hooks/use-organizations';
import { UserFormDialog } from '@/features/users/components/user-form-dialog';
import { UsersTable } from '@/features/users/components/users-table';
import { useDeactivateUser, useUsersList } from '@/features/users/hooks/use-users';
import { useAuthStore } from '@/shared/stores/auth-store';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Input } from '@/shared/components/ui/input';
import { PaginationBar } from '@/shared/components/ui/pagination-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { UnderDevelopment } from '@/shared/components/layout/under-development';

const ALL = '__all__';

export default function UsersPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.USERS_READ);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [isActive, setIsActive] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUserDto | null>(null);

  const { data: tree } = useOrganizationsTree();
  const flatOrgs = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);

  const { data, isLoading } = useUsersList({
    page,
    perPage: 20,
    search: search || undefined,
    organizationId: organizationId || undefined,
    role: (role || undefined) as Role | undefined,
    isActive: isActive === '' ? undefined : isActive === 'true',
  });

  const deactivate = useDeactivateUser();

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  const canCreate = hasPermission(PERMISSION.USERS_CREATE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Foydalanuvchilar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platformadagi barcha foydalanuvchilarni boshqarish — rol va tashkilot biriktirish.
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Foydalanuvchi qo'shish
          </Button>
        ) : null}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ism, email yoki telefon bo'yicha qidirish…"
              className="pl-10"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>

          <Select
            value={organizationId || ALL}
            onValueChange={(v) => {
              setPage(1);
              setOrganizationId(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tashkilot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha tashkilotlar</SelectItem>
              {flatOrgs.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {'—'.repeat(opt.depth)} {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={role || ALL}
            onValueChange={(v) => {
              setPage(1);
              setRole(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha rollar</SelectItem>
              {Object.values(ROLE).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS_UZ[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={isActive || ALL}
            onValueChange={(v) => {
              setPage(1);
              setIsActive(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Holati" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barchasi</SelectItem>
              <SelectItem value="true">Faol</SelectItem>
              <SelectItem value="false">Faol emas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <UsersTable
          users={data?.data ?? []}
          isLoading={isLoading}
          onEdit={(user) => {
            setEditingUser(user);
            setFormOpen(true);
          }}
          onDeactivate={(user) => setDeactivating(user)}
        />
        {data?.meta ? (
          <PaginationBar meta={data.meta} onPageChange={setPage} itemLabel="ta foydalanuvchi" />
        ) : null}
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`${deactivating?.firstName ?? ''} ${deactivating?.lastName ?? ''}ni faolsizlantirasizmi?`}
        description="Foydalanuvchi tizimga kira olmay qoladi. Keyinchalik uni qayta faollashtirishingiz mumkin."
        confirmLabel="Ha, faolsizlantirish"
        loading={deactivate.isPending}
        onConfirm={() => {
          if (!deactivating) return;
          deactivate.mutate(deactivating.id, {
            onSuccess: () => setDeactivating(null),
          });
        }}
      />
    </div>
  );
}
