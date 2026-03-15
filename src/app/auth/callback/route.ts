import { type NextRequest } from 'next/server'

import { GET as confirmGet } from '@/app/auth/confirm/route'

export async function GET(request: NextRequest) {
  return confirmGet(request)
}
