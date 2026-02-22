import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const tiles = [
  { id:'new',      num:'01', title:'New Analysis',         desc:'Launch a fresh AI-powered trade intelligence run on any product.',      href:'/new',        accent:'#38BDF8', glow:'rgba(56,189,248,0.15)'  },
  { id:'saved',    num:'02', title:'Intelligence Library',  desc:'Resume previous analyses, compare scenarios and export reports.',       href:'/saved',      accent:'#818CF8', glow:'rgba(129,140,248,0.15)' },
  { id:'settings', num:'03', title:'Settings',              desc:'Configure currencies, regions, measurement units and alert thresholds.',href:'/settings',   accent:'#34D399', glow:'rgba(52,211,153,0.15)'  },
  { id:'how-to',   num:'04', title:'How to Use',            desc:'Guided walkthroughs, tips, and best practices for the platform.',       href:'/how-to',     accent:'#F472B6', glow:'rgba(244,114,182,0.15)' },
]

export default function Home() {
  return (
    <div>
      {/* Hero heading */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ marginBottom: '2.5rem' }}
      >
        <p className="label" style={{ marginBottom: '0.8rem' }}>Command Centre</p>
        <h2 style={{
          fontFamily: '"Syne", sans-serif',
          fontWeight: 800,
          fontSize: 'clamp(2rem, 5vw, 2.8rem)',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          color: 'var(--text)',
        }}>
          Where should we<br />
          <span className="shimmer-text">start today?</span>
        </h2>
      </motion.div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        {tiles.map((tile, i) => (
          <motion.div
            key={tile.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            <Tile tile={tile} />
          </motion.div>
        ))}
      </div>

      {/* CTA strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        style={{
          marginTop: '2rem',
          padding: '1.25rem 1.75rem',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          background: 'rgba(56,189,248,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <p className="label" style={{ marginBottom: '0.2rem' }}>Ready to begin?</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Run a full AI classification in under 2 minutes.</p>
        </div>
        <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link to="/new" className="button button-primary">
            Begin Analysis →
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

function Tile({ tile }) {
  return (
    <motion.div
      whileHover={{ y: -7, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        position: 'relative',
        borderRadius: '22px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 6px 28px rgba(0,0,0,0.35)',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
        background: `linear-gradient(90deg, transparent, ${tile.accent}55, transparent)`,
      }} />

      {/* Corner glow */}
      <div style={{
        position: 'absolute', bottom: -24, right: -24,
        width: 96, height: 96, borderRadius: '50%',
        background: `radial-gradient(circle, ${tile.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Full-card link */}
      <Link
        to={tile.href}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 190,
          padding: '1.75rem',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {/* Number */}
        <div style={{
          position: 'absolute', top: '1.4rem', right: '1.4rem',
          fontFamily: '"DM Mono", monospace',
          fontSize: '0.62rem', letterSpacing: '0.15em',
          color: tile.accent, opacity: 0.55,
        }}>{tile.num}</div>

        {/* Dot */}
        <div style={{
          width: 9, height: 9, borderRadius: '50%',
          background: tile.accent,
          boxShadow: `0 0 10px ${tile.accent}`,
          marginBottom: '1.1rem',
        }} />

        <div>
          <h3 style={{
            fontFamily: '"Syne", sans-serif',
            fontWeight: 700, fontSize: '1.1rem',
            letterSpacing: '-0.02em',
            color: 'var(--text)', marginBottom: '0.45rem',
          }}>{tile.title}</h3>

          <p style={{
            fontSize: '0.855rem', color: 'var(--text-muted)',
            lineHeight: 1.6, marginBottom: '1.1rem',
          }}>{tile.desc}</p>

          <span style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '0.68rem', letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tile.accent, opacity: 0.85,
          }}>Open →</span>
        </div>
      </Link>
    </motion.div>
  )
}
