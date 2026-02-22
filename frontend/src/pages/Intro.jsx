import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Intro() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => navigate('/home'), 2800)
    return () => clearTimeout(t)
  }, [navigate])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.45 + 0.1,
      electric: Math.random() > 0.4,
    }))
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d < 130) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(56,189,248,${0.1 * (1 - d / 130)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.electric ? `rgba(56,189,248,${p.alpha})` : `rgba(147,197,253,${p.alpha})`
        ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #070D18 0%, #050709 100%)',
      zIndex: 100,
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 70%)',
        animation: 'pulseGlow 3.5s ease-in-out infinite',
      }} />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.5em' }}
          animate={{ opacity: 1, letterSpacing: '0.22em' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            fontFamily: '"DM Mono", monospace', fontSize: '0.63rem',
            textTransform: 'uppercase', color: 'rgba(56,189,248,0.65)',
            marginBottom: '1.5rem',
          }}
        >
          Tradewave Intelligence Suite
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: '"Syne", sans-serif', fontWeight: 800,
            fontSize: 'clamp(3.5rem, 10vw, 5.5rem)',
            letterSpacing: '-0.045em', lineHeight: 1,
            background: 'linear-gradient(135deg, #38BDF8 0%, #fff 45%, #7DD3FC 70%, #38BDF8 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmerIntro 3.5s linear infinite',
          }}
        >
          TRADEMASTER
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.75 }}
          style={{
            height: 1, margin: '1.5rem auto', width: '55%',
            background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.55), transparent)',
          }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          style={{
            fontFamily: '"DM Mono", monospace', fontSize: '0.72rem',
            letterSpacing: '0.18em', textTransform: 'uppercase', color: '#E8EFF8',
          }}
        >
          Loading intelligence canvas…
        </motion.p>

        <motion.div
          style={{ height: 1, margin: '2rem auto 0', borderRadius: 999,
            background: 'rgba(56,189,248,0.08)', overflow: 'hidden', width: 180 }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.3, delay: 0.5, ease: 'easeInOut' }}
            style={{ height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, #38BDF8, #3B82F6)' }}
          />
        </motion.div>
      </div>

      <style>{`
        @keyframes shimmerIntro {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
