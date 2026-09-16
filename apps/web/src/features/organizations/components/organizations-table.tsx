'use client';

import { ORGANIZATION_TYPE_LABELS_UZ, type AdminOrganizationDto } from '@eco/shared';
import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

interface OrganizationsTableProps {
  organizations: AdminOrganizationDto[];
  isLoading: boolean;
  onEdit: (org: AdminOrganizationDto) => void;
  onRemove: (org: AdminOrganizationDto) => void;
}

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
  onRemove,
}: OrganizationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nomi</TableHead>
          <TableHead>Turi</TableHead>
          <TableHead>Kod</TableHead>
          <TableHead>Foydalanuvchilar</TableHead>
          <TableHead>Quyi tashkilotlar</TableHead>
          <TableHead className="text-right">Amallar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableEmpty colSpan={6}>Yuklanmoqda…</TableEmpty>
        ) : organizations.length === 0 ? (
          <TableEmpty colSpan={6}>Tashkilotlar topilmadi</TableEmpty>
        ) : (
          organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.nameUz}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ORGANIZATION_TYPE_LABELS_UZ[org.type]}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{org.code}</TableCell>
              <TableCell>{org.usersCount}</TableCell>
              <TableCell>{org.childrenCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(org)} title="Tahrirlash">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(org)}
                    title="O'chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
