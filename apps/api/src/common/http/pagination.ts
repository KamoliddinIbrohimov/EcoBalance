import type { PaginatedMeta } from '@eco/shared';

export interface Page<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface PageQuery {
  page: number;
  perPage: number;
  limit?: number;
}

/** `limit` — eski alias, berilsa perPage o'rniga. */
export function pageArgs(q: PageQuery) {
  const perPage = q.limit ?? q.perPage;
  return { page: q.page, perPage, skip: (q.page - 1) * perPage, take: perPage };
}

export function toPage<T>(data: T[], total: number, page: number, perPage: number): Page<T> {
  return {
    data,
    meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  };
}
