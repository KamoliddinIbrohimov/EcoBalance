'use client';

import type { CreateUserInput, UpdateUserInput, UserQuery } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rolesApi, usersApi } from '../api/users-api';

const USERS_KEY = ['admin', 'users'] as const;
const ROLES_KEY = ['admin', 'roles'] as const;

export function useUsersList(query: Partial<UserQuery>) {
  return useQuery({
    queryKey: [...USERS_KEY, query],
    queryFn: () => usersApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useRolesOptions() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: () => rolesApi.list(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      usersApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
