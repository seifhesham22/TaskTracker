export interface BacklogPaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPageChange: (newPage: number) => void;
}

export function BacklogPagination({
  page,
  totalPages,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: BacklogPaginationProps) {
  if (totalPages <= 1 && totalCount <= 0) {
    return null;
  }

  const effectiveTotalPages = Math.max(totalPages, 1);

  return (
    <nav className="backlog-pagination" aria-label="Backlog pagination">
      <div className="backlog-pagination-info" data-testid="backlog-pagination-info">
        Page {page} of {effectiveTotalPages} · {totalCount} {totalCount === 1 ? 'item' : 'items'}
      </div>
      <div className="backlog-pagination-controls">
        <button
          type="button"
          className="backlog-page-btn"
          disabled={!hasPreviousPage || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          data-testid="backlog-prev-page-btn"
        >
          Previous
        </button>
        <button
          type="button"
          className="backlog-page-btn"
          disabled={!hasNextPage || page >= effectiveTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          data-testid="backlog-next-page-btn"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
