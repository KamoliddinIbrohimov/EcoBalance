'use client';

import {
  ORGANIZATION_TYPE,
  ORGANIZATION_TYPE_LABELS_UZ,
  PERMISSION,
  type AdminOrganizationDto,
} from '@eco/shared';
import { Building2, Search } from 'lucide-react';
import { useState } from 'react';

import { OrganizationFormDialog } from '@/features/organizations/components/organization-form-dialog';
import { OrganizationsTable } from '@/features/organizations/components/organizations-table';
import { useOrganizationsList, useRemoveOrganization } from '@/features/organizations/hooks/use-organizations';
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
import type { ApiError } from '@/shared/lib/api-client';

const ALL = '__all__';

export default function OrganizationsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission(PERMISSION.ORGS_READ);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AdminOrganizationDto | null>(null);
  const [removing, setRemoving] = useState<AdminOrganizationDto | null>(null);

  const { data, isLoading } = useOrganizationsList({
    page,
    perPage: 20,
    search: search || undefined,
    type: (type || undefined) as (typeof ORGANIZATION_TYPE)[keyof typeof ORGANIZATION_TYPE] | undefined,
  });

  const remove = useRemoveOrganization();
  const removeError = remove.error as ApiError | undefined;

  if (!canRead) {
    return <UnderDevelopment description="Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q." />;
  }

  const canCreate = hasPermission(PERMISSION.ORGS_CREATE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tashkilotlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shahar → tuman → mahalla/maktab ierarxiyasini boshqarish.
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditingOrg(null);
              setFormOpen(true);
            }}
          >
            <Building2 className="h-4 w-4" />
            Tashkilot qo'shish
          </Button>
        ) : null}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nomi yoki kod bo'yicha qidirish…"
              className="pl-10"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>

          <Select
            value={type || ALL}
            onValueChange={(v) => {
              setPage(1);
              setType(v === ALL ? '' : v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha turlar</SelectItem>
              {Object.values(ORGANIZATION_TYPE).map((t) => (
                <SelectItem key={t} value={t}>
                  {ORGANIZATION_TYPE_LABELS_UZ[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <OrganizationsTable
          organizations={data?.data ?? []}
          isLoading={isLoading}
          onEdit={(org) => {
            setEditingOrg(org);
            setFormOpen(true);
          }}
          onRemove={(org) => setRemoving(org)}
        />
        {data?.meta ? (
          <PaginationBar meta={data.meta} onPageChange={setPage} itemLabel="ta tashkilot" />
        ) : null}
      </Card>

      <OrganizationFormDialog open={formOpen} onOpenChange={setFormOpen} organization={editingOrg} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`"${removing?.nameUz ?? ''}" tashkilotini o'chirasizmi?`}
        description={
          removeError?.message ??
          "Faqat foydalanuvchisi va quyi tashkiloti bo'lmagan tashkilotlarni o'chirish mumkin."
        }
        confirmLabel="Ha, o'chirish"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </div>
  );
}
