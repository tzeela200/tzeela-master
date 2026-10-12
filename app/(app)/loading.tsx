export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10" aria-busy="true">
      <span className="sr-only" role="status">
        טוען…
      </span>
      <div className="mb-6 h-9 w-56 animate-pulse rounded-input bg-border" />
      <div className="mb-6 h-12 w-full animate-pulse rounded-input bg-border/70" />
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-card bg-border/70" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card bg-surface shadow-soft" />
        ))}
      </div>
    </main>
  );
}
