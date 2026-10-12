export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-input bg-border/80 ${className}`} />;
}

export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        טוען…
      </span>
      {children}
    </div>
  );
}
