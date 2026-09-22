import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

type Variant = 'you' | 'her' | 'together' | 'ghost'

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  children: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  you: 'bg-you text-white shadow-you',
  her: 'bg-her text-white shadow-her',
  together: 'bg-together text-white shadow-you',
  ghost: 'bg-surface text-ink border border-ink-soft/20',
}

export function Button({ variant = 'you', className = '', children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`rounded-(--radius) px-5 py-3 font-semibold disabled:opacity-40 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}
