import { motion } from 'framer-motion'

export default function LoadingSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const dims = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }[size]

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <motion.div
        className={`${dims} rounded-full border-2 border-[#2a2a2a] border-t-[#d4a843]`}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      {label && <p className="text-sm text-[#6b6b6b]">{label}</p>}
    </div>
  )
}
