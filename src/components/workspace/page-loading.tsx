export function PageLoading({ label }: { label: string }) {
  return (
    <div className="page-loading" role="status">
      <span className="skeleton skeleton-title" aria-hidden="true" />
      <span className="skeleton skeleton-line" aria-hidden="true" />
      <div className="skeleton-grid" aria-hidden="true"><span className="skeleton" /><span className="skeleton" /></div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
