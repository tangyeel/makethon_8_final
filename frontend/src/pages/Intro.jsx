import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Intro() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/home'), 1800)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center"
      >
        <p className="label">Tradewave Intelligence Suite</p>
        <h1 className="mt-4 font-display text-4xl tracking-[0.35em] text-white sm:text-5xl">
          TRADEMASTER
        </h1>
        <h2 className="mt-2 font-display text-3xl tracking-[0.35em] text-white sm:text-4xl">
          ANIMATION
        </h2>
        <p className="mt-6 text-sm text-white/60">Loading intelligence canvas...</p>
      </motion.div>
    </div>
  )
}
