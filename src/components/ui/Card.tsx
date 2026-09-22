import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tint?: 'none' | 'you' | 'her'
  children: ReactNode
}

const TINT_CLASSES: Record<NonNullable<CardProps['tint']>, string> = {
  none: 'bg-surface',
  you: 'bg-you-tint',
  her: 'bg-her-tint',
}

export function Card({ tint = 'none', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-(--radius) p-5 ${TINT_CLASSES[tint]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
