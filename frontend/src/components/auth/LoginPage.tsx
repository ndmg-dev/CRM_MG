import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

import { useGoogleLogin } from '@react-oauth/google'

// ---------------------------------------------------------------------------
// Floating Particle component — small gold dots that drift around the screen
// ---------------------------------------------------------------------------
function FloatingParticle({ index }: { index: number }) {
  const seed = useMemo(() => {
    const s = (i: number) => ((i * 7919 + 104729) % 100) / 100
    return {
      x: s(index) * 100,
      y: s(index + 1) * 100,
      size: 2 + s(index + 2) * 4,
      duration: 18 + s(index + 3) * 24,
      delay: s(index + 4) * 8,
      opacity: 0.15 + s(index + 5) * 0.35,
    }
  }, [index])

  return (
    <motion.div
      className="absolute rounded-full bg-gold"
      style={{
        width: seed.size,
        height: seed.size,
        left: `${seed.x}%`,
        top: `${seed.y}%`,
      }}
      animate={{
        x: [0, 30 * Math.sin(index), -20 * Math.cos(index), 0],
        y: [0, -25 * Math.cos(index), 15 * Math.sin(index), 0],
        opacity: [seed.opacity, seed.opacity * 1.5, seed.opacity * 0.6, seed.opacity],
      }}
      transition={{
        duration: seed.duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: seed.delay,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Inline Google "G" logo SVG
// ---------------------------------------------------------------------------
function GoogleLogo() {
  return (
    <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [isLoading, setIsLoading] = useState(false)

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate('/', { replace: true })
    return null
  }

  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => i), [])

  // ---------------------------------------------------------------------------
  // Google Sign-In handler
  // ---------------------------------------------------------------------------
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (credentialResponse) => {
      setIsLoading(true)
      try {
        const response = await api.auth.loginWithGoogle(credentialResponse.access_token)
        login(response.token, response.usuario)
        toast.success('Login realizado com sucesso!')
        navigate('/', { replace: true })
      } catch {
        toast.error('Falha ao realizar login. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    },
    onError: () => {
      toast.error('Falha ao autenticar com o Google.')
    },
  })

  const handleGoogleLogin = () => {
    loginWithGoogle()
  }

  // ---------------------------------------------------------------------------
  // Animation variants
  // ---------------------------------------------------------------------------
  const cardVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  }

  const staggerContainer: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.3 },
    },
  }

  const fadeUp: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* ── Floating particles ── */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((i) => (
          <FloatingParticle key={i} index={i} />
        ))}
      </div>

      {/* ── Radial ambient glow ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/5 blur-[120px]" />
      </div>

      {/* ── Login Card ── */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-10 shadow-[0_-4px_30px_-10px_rgba(212,168,67,0.2)] backdrop-blur-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4a843]/60 to-transparent" />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Logo Image */}
          <motion.div variants={fadeUp} className="mb-4">
            <img 
              src="/logo.png" 
              alt="Mendonça Galvão CRM Contábil" 
              className="mx-auto h-32 w-auto object-contain drop-shadow-md"
            />
          </motion.div>

          {/* Subtitle */}
          <motion.h2 variants={fadeUp} className="mt-4 text-xl font-bold text-white tracking-wide">
            CRM Contábil
          </motion.h2>
          <motion.p variants={fadeUp} className="text-sm font-medium text-text-secondary mt-1">
            Gestão Inteligente
          </motion.p>
          <motion.p variants={fadeUp} className="mb-8 mt-1.5 text-xs text-text-muted">
            Seu canal seguro de acesso aos sistemas internos
          </motion.p>

          {/* Google login button */}
          <motion.button
            variants={fadeUp}
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-black shadow-md transition-all duration-200 hover:bg-[#e5bc55] hover:shadow-[0_0_15px_rgba(212,168,67,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-black/70" />
            ) : (
              <GoogleLogo />
            )}
            {isLoading ? 'Autenticando...' : 'Entrar com Google Workspace'}
          </motion.button>

          {/* Divider */}
          <motion.div
            variants={fadeUp}
            className="my-6 h-px w-full bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent"
          />

          {/* Restriction notice */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center justify-center text-xs text-text-muted"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#4ade80]" />
              <span>Acesso restrito a colaboradores</span>
            </div>
            <p>Domínio <span className="text-text-secondary">@mendoncagalvao.com.br</span></p>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-6 left-0 right-0 text-center text-xs text-text-muted space-y-1"
      >
        <p>Mendonça Galvão Contadores Associados</p>
        <p>CRM Contábil © 2026</p>
      </motion.div>
    </div>
  )
}
