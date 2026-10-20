import { cn } from '@/lib/utils'
import { projectColorStyle } from '@/lib/colors'
import type { ContractType } from '@/lib/types'

const BADGE_COLORS: Record<ContractType, string> = {
  UoP: '#10b981',
  B2B: '#0ea5e9',
  Freelance: '#f59e0b',
  'Umowa Zlecenie': '#8b5cf6',
  'Umowa o Dzieło': '#f97316',
  'Powołanie do Zarządu': '#e11d48',
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
      style={projectColorStyle(BADGE_COLORS[type])}
      className={cn(
        'project-colors project-badge inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold leading-tight shrink-0',
        className
      )}
    >
      {SHORT_LABELS[type] ?? type}
    </span>
  )
}
