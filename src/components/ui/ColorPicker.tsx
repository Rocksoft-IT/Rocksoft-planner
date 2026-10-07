'use client'

import { PROJECT_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-7 h-7 rounded-full transition-transform hover:scale-110',
            value === color && 'ring-2 ring-white light:ring-slate-900 ring-offset-2 ring-offset-slate-900 light:ring-offset-white scale-110'
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}
