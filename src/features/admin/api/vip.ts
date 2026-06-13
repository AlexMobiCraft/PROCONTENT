import type { VipCreateValues } from '../types'

const ENDPOINT = '/api/admin/vip'

/** Маппинг кодов ошибок API → словенские сообщения для toast. */
function messageForError(code: string | undefined): string {
  switch (code) {
    case 'active_subscription':
      return 'Uporabnik ima aktivno naročnino'
    case 'forbidden':
      return 'Nimate pravic za to dejanje'
    case 'validation':
      return 'Neveljavni podatki'
    case 'user_not_found':
      return 'Uporabnik ne obstaja'
    case 'cannot_delete_admin':
      return 'Administratorja ni mogoče izbrisati'
    default:
      return 'Prišlo je do napake'
  }
}

async function parseError(res: Response): Promise<never> {
  let code: string | undefined
  try {
    const data = (await res.json()) as { error?: string }
    code = data.error
  } catch {
    // тело не JSON — оставляем дефолтное сообщение
  }
  throw new Error(messageForError(code))
}

export interface VipCreateResult {
  /** true, если email уже был зарегистрирован (VIP присвоен без повторного invite). */
  existing: boolean
  userId: string
}

export async function createVipUser(values: VipCreateValues): Promise<VipCreateResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
  if (!res.ok) return parseError(res)
  const data = (await res.json()) as { existing?: boolean; userId: string }
  return { existing: data.existing === true, userId: data.userId }
}

export async function suspendVip(userId: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action: 'suspend' }),
  })
  if (!res.ok) await parseError(res)
}

export async function resumeVip(userId: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action: 'resume' }),
  })
  if (!res.ok) await parseError(res)
}

export async function deleteVip(userId: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) await parseError(res)
}
