'use client';

import { ROLE_LABELS_UZ, type AdminUserDto, type Role } from '@eco/shared';
import { Pencil, UserX } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { StatusDot } from '@/shared/components/ui/status-dot';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

interface UsersTableProps {
  users: AdminUserDto[];
  isLoading: boolean;
  onEdit: (user: AdminUserDto) => void;
  onDeactivate: (user: AdminUserDto) => void;
}

export function UsersTable({ users, isLoading, onEdit, onDeactivate }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Foydalanuvchi</TableHead>
          <TableHead>Tashkilot</TableHead>
          <TableHead>Rollar</TableHead>
          <TableHead>Holati</TableHead>
          <TableHead className="text-right">Amallar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableEmpty colSpan={5}>Yuklanmoqda…</TableEmpty>
        ) : users.length === 0 ? (
          <TableEmpty colSpan={5}>Foydalanuvchilar topilmadi</TableEmpty>
        ) : (
          users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </TableCell>
              <TableCell>
                {user.organization ? (
                  <span className="text-sm">{user.organization.nameUz}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {ROLE_LABELS_UZ[role as Role]}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusDot
                  variant={user.isActive ? 'good' : 'bad'}
                  label={user.isActive ? 'Faol' : 'Faol emas'}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(user)} title="Tahrirlash">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {user.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDeactivate(user)}
                      title="Faolsizlantirish"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
