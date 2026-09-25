'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative flex flex-col max-h-[calc(100dvh-2rem)] bg-slate-900 light:bg-white border border-slate-700 light:border-slate-200 rounded-xl shadow-2xl w-full max-w-md', className)}>
        <div className="flex shrink-0 items-center justify-between p-5 border-b border-slate-700 light:border-slate-200">
          <h2 className="text-base font-semibold text-white light:text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white light:hover:text-slate-900 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  )
}
