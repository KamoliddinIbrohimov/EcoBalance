'use client';

import type { CreateOrganizationInput, OrganizationQuery, UpdateOrganizationInput } from '@eco/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { organizationsApi } from '../api/organizations-api';

const ORGS_KEY = ['admin', 'organizations'] as const;
const ORGS_TREE_KEY = ['admin', 'organizations', 'tree'] as const;

export function useOrganizationsList(query: Partial<OrganizationQuery>) {
  return useQuery({
    queryKey: [...ORGS_KEY, query],
    queryFn: () => organizationsApi.list(query),
    placeholderData: (previous) => previous,
  });
}

/** Full hierarchy — used to populate the "parent organization" picker. */
export function useOrganizationsTree() {
  return useQuery({
    queryKey: ORGS_TREE_KEY,
    queryFn: () => organizationsApi.tree(),
    staleTime: 60_000,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => organizationsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORGS_KEY });
      void qc.invalidateQueries({ queryKey: ORGS_TREE_KEY });
    },
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrganizationInput }) =>
      organizationsApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORGS_KEY });
      void qc.invalidateQueries({ queryKey: ORGS_TREE_KEY });
    },
  });
}

export function useRemoveOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORGS_KEY });
      void qc.invalidateQueries({ queryKey: ORGS_TREE_KEY });
    },
  });
}

/** Flattens the tree into "— " indented options for a plain <select>. */
export function flattenTree(
  nodes: { id: string; nameUz: string; children: unknown[] }[],
  depth = 0,
): { id: string; label: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: node.nameUz, depth },
    ...flattenTree(node.children as typeof nodes, depth + 1),
  ]);
}
