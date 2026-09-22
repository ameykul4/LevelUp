import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-[28px] max-h-[85svh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-ink-soft/10">
              <h2 className="font-display text-xl">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink-soft"
              >
                ✕
              </button>
            </div>
            <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
