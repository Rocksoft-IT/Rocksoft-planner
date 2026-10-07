import { cn } from '@/lib/utils'
import type { ContractType } from '@/lib/types'

const BADGE_STYLES: Record<ContractType, string> = {
  UoP:       'bg-emerald-500/15 text-emerald-300 light:text-emerald-700 border-emerald-500/30',
  B2B:       'bg-sky-500/15 text-sky-300 light:text-sky-700 border-sky-500/30',
  Freelance: 'bg-amber-500/15 text-amber-300 light:text-amber-700 border-amber-500/30',
  'Umowa Zlecenie': 'bg-violet-500/15 text-violet-300 light:text-violet-700 border-violet-500/30',
  'Umowa o Dzieło': 'bg-orange-500/15 text-orange-300 light:text-orange-700 border-orange-500/30',
  'Powołanie do Zarządu': 'bg-rose-500/15 text-rose-300 light:text-rose-700 border-rose-500/30',
}

const SHORT_LABELS: Partial<Record<ContractType, string>> = {
  'Umowa Zlecenie': 'UZ',
  'Umowa o Dzieło': 'UoD',
  'Powołanie do Zarządu': 'Zarząd',
}

// Small pill showing a team member's contract type; renders nothing when unset.
export default function ContractTypeBadge({ type, className }: { type: ContractType | null; className?: string }) {
  if (!type) return null
  return (
    <span
      title={type}
      aria-label={type}
      className={cn(
        'inline-flex items-center px-1.5 py-px rounded border text-[10px] font-semibold leading-tight shrink-0',
        BADGE_STYLES[type],
        className
      )}
    >
      {SHORT_LABELS[type] ?? type}
    </span>
  )
}
