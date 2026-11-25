import type { NextRequest } from 'next/server'
import { protectedResourceMetadataResponse } from '@/lib/mcp/config'

export const dynamic = 'force-dynamic'

// GET /api/mcp/oauth-protected-resource — the metadata URL /api/mcp's 401 points to.
export function GET(request: NextRequest) {
  return protectedResourceMetadataResponse(request)
}
