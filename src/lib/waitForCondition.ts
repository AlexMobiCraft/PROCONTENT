export async function waitForCondition(
  predicate: () => boolean,
  options: { timeoutMs: number; intervalMs?: number }
): Promise<void> {
  if (predicate()) return

  const intervalMs = options.intervalMs ?? 100
  const deadline = Date.now() + options.timeoutMs

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    if (predicate()) return
  }
}
