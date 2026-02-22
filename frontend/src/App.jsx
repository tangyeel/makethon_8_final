import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAnalysis } from './hooks/useAnalysis.js'
import ThemeToggle from './components/ThemeToggle.jsx'
import Intro from './pages/Intro.jsx'
import Home from './pages/Home.jsx'
import NewAnalysisChoice from './pages/NewAnalysisChoice.jsx'
import NewAnalysis from './pages/NewAnalysis.jsx'
import ProductImageAnalyzer from './pages/ProductImageAnalyzer.jsx'
import Results from './pages/Results.jsx'
import SavedAnalysis from './pages/SavedAnalysis.jsx'
import Settings from './pages/Settings.jsx'
import HowToUse from './pages/HowToUse.jsx'
import About from './pages/About.jsx'
import CustomsChatbot from './components/CustomsChatbot.jsx'

const Shell = ({ children, hideHeader, pageTitle, showNewAnalysis, onBack }) => (
  <div className="min-h-screen px-5 pb-16 sm:px-8 lg:px-12">
    {!hideHeader && (
      <motion.header
        className="site-header mx-auto w-full max-w-6xl"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-start justify-between gap-8">
          <div>
            <Link to="/home" style={{ textDecoration: 'none' }}>
              <div className="brand-mark">TradeMaster</div>
            </Link>
            <p className="brand-sub">Global Intelligence Suite</p>
          </div>
          <div className="header-actions">
            <div className="header-meta">
              <button className="header-back" type="button" onClick={onBack}>Go back</button>
              {pageTitle && <span className="page-name">{pageTitle}</span>}
              {showNewAnalysis && (
                <span className="meta-link" style={{ color: 'var(--electric)', opacity: 0.9 }}>
                  New Analysis
                </span>
              )}
              <Link className="meta-link meta-link-button nav-link" to="/about">About</Link>
              <Link className="meta-link meta-link-button nav-link" to="/saved">Library</Link>
            </div>
            <div className="header-controls">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </motion.header>
    )}
    <main className={`mx-auto w-full max-w-6xl ${hideHeader ? 'mt-0' : 'mt-10'}`}>
      {children}
    </main>
  </div>
)

export default function App() {
  const { analysis } = useAnalysis()
  const location = useLocation()
  const navigate = useNavigate()
  const hideHeader = location.pathname === '/'

  const pageTitle = useMemo(() => {
    const titles = {
      '/home': 'Home',
      '/new': '',
      '/analysis': 'Product Details',
      '/image-analyzer': 'Image Analyzer',
      '/results': 'Results',
      '/saved': 'Saved Analysis',
      '/settings': 'Settings',
      '/how-to': 'How to Use',
      '/about': 'About',
    }
    return titles[location.pathname] ?? 'Global Trade Intelligence'
  }, [location.pathname])

  const showNewAnalysis = location.pathname === '/new'

  const handleBack = () => {
    if (window.history.length > 1) { navigate(-1); return }
    navigate(location.pathname === '/home' ? '/' : '/home')
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('theme') || 'dark'
    document.documentElement.dataset.theme = stored
  }, [])

  return (
    <>
      <Shell hideHeader={hideHeader} pageTitle={pageTitle} showNewAnalysis={showNewAnalysis} onBack={handleBack}>
        <Routes>
          <Route path="/"               element={<Intro />} />
          <Route path="/home"           element={<Home />} />
          <Route path="/new"            element={<NewAnalysisChoice />} />
          <Route path="/analysis"       element={<NewAnalysis />} />
          <Route path="/image-analyzer" element={<ProductImageAnalyzer />} />
          <Route path="/results"        element={<Results />} />
          <Route path="/saved"          element={<SavedAnalysis />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/how-to"         element={<HowToUse />} />
          <Route path="/about"          element={<About />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>

      {/* Global Customs Chatbot — visible on all pages */}
      <CustomsChatbot />
    </>
  )
}
