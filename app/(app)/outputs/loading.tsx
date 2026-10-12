import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function OutputsLoading() {
  return (
    <LoadingRegion>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <Skeleton className="mb-6 h-9 w-32" />
        <Skeleton className="mb-4 h-12 w-full" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card bg-surface p-5 shadow-soft">
              <Skeleton className="mb-3 h-5 w-3/4" />
              <Skeleton className="mb-4 h-4 w-1/3" />
              <Skeleton className="h-11 w-36" />
            </div>
          ))}
        </div>
      </main>
    </LoadingRegion>
  );
}
