import { cn } from '@/lib/utils'
import type { ContractType } from '@/lib/types'

const BADGE_STYLES: Record<ContractType, string> = {
  UoP:       'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  B2B:       'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Freelance: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

// Small pill showing a team member's contract type; renders nothing when unset.
export default function ContractTypeBadge({ type, className }: { type: ContractType | null; className?: string }) {
  if (!type) return null
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-px rounded border text-[10px] font-semibold leading-tight shrink-0',
        BADGE_STYLES[type],
        className
      )}
    >
      {type}
    </span>
  )
}
