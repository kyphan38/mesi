/** Skeleton UIs that approximate real screens to reduce layout shift while gates resolve. */

export function HomeLikeSkeleton() {
  return (
    <div className="bg-background flex min-h-[60vh] flex-1 flex-col">
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
        <div className="flex gap-2">
          <div className="bg-muted size-11 animate-pulse rounded-lg" />
          <div className="bg-muted size-11 animate-pulse rounded-lg" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[430px] flex-1 space-y-4 px-4 py-4">
        <div className="bg-muted h-20 w-full animate-pulse rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted h-11 min-w-[5rem] animate-pulse rounded-full" />
          ))}
        </div>
        <div className="bg-muted h-24 w-full animate-pulse rounded-2xl" />
        <div className="bg-primary/20 h-12 w-full animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

export function ProfileGateSkeleton() {
  return (
    <div className="bg-background flex min-h-[50vh] flex-1 flex-col px-4 py-6">
      <div className="bg-muted mx-auto mb-6 h-8 max-w-md animate-pulse rounded-md" />
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="bg-muted h-32 w-full animate-pulse rounded-2xl" />
        <div className="bg-muted h-40 w-full animate-pulse rounded-2xl" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
