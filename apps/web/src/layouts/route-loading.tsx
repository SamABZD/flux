export function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading page">
      <span className="skeleton" style={{ width: '40%', height: '2rem' }} />
      <span className="skeleton" style={{ height: '20rem' }} />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
