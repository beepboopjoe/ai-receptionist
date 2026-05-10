// ============================================================
// Pagination helpers
// ============================================================
import type { PaginatedResponse } from '@ai-receptionist/shared';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(query['page'] ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query['pageSize'] ?? 20)));
  return { page, pageSize };
}

export function paginationToOffset(params: PaginationParams): { limit: number; offset: number } {
  return {
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}
