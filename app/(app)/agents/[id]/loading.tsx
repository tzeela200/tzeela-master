import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function WorkspaceLoading() {
  return (
    <LoadingRegion>
      <div className="flex h-dvh flex-col" data-workspace>
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">
          <Skeleton className="ms-0 me-auto h-14 w-2/3 rounded-card" />
          <Skeleton className="ms-auto me-0 h-32 w-5/6 rounded-card" />
        </div>
        <div className="border-t border-border bg-surface p-3">
          <Skeleton className="mx-auto h-12 max-w-3xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}
