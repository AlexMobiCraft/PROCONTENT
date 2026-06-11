// main-роутер edge-runtime (запускается с `--main-service /home/deno/functions/main`).
// Диспатчит входящий запрос на функцию по первому сегменту пути и исполняет её
// в изолированном user-worker. Адаптация официального self-hosted шаблона Supabase.
//
// Лимиты подняты под видео-декодирование ffmpeg.wasm (Story 8.5): больше памяти и
// CPU/wall-clock, чем дефолтные 150 MB / 10 с. Save-time fallback всё равно ограничен
// клиентским бюджетом 2500 мс (AbortController), standalone/bulk — таймаутом вызова.

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const serviceName = url.pathname.split('/').filter(Boolean)[0]

  if (!serviceName) {
    return new Response(JSON.stringify({ error: 'missing function name in request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const servicePath = `/home/deno/functions/${serviceName}`

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 256,
      workerTimeoutMs: 60_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
      forceCreate: false,
      netAccessDisabled: false,
      cpuTimeSoftLimitMs: 30_000,
      cpuTimeHardLimitMs: 55_000,
    })

    return await worker.fetch(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[main] worker error for "${serviceName}":`, message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
    })
  }
})

// Минимальные декларации Deno/EdgeRuntime для редакторов вне Deno-окружения.
// (Проектный tsc/eslint этот каталог не обрабатывают — supabase/functions исключён.)
declare const EdgeRuntime: {
  userWorkers: {
    create(opts: Record<string, unknown>): Promise<{ fetch(req: Request): Promise<Response> }>
  }
}
