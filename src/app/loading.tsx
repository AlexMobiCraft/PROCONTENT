export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <div className="border-muted border-t-primary h-8 w-8 animate-spin rounded-full border-4" />
    </div>
  )
}
