import { useState, useEffect } from 'react';

export const PAGE_SIZE = 10;

export function usePagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);

  // Reset to page 1 when the list changes (filter, tab switch, etc.)
  useEffect(() => { setPage(1); }, resetDeps); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return { page: safePage, setPage, totalPages, pageItems };
}
