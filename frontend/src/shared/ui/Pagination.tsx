export function Pagination({
  page,
  totalItems,
  size,
  label,
  busy,
  onPageChange,
}: {
  page: number
  totalItems: number
  size: number
  label: string
  busy: boolean
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / size))
  return (
    <nav className="list-pagination" aria-label={label}>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page + 1} of {totalPages} · {totalItems} results
      </span>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
