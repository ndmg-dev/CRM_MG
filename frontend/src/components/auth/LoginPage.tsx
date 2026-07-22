import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { establishUnifiedSession } from '@/lib/unifiedAuth'

import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'

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
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [isLoading, setIsLoading] = useState(false)

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => i), [])

  // ---------------------------------------------------------------------------
  // Google Sign-In handler — sessão unificada (CRM + Central de Suporte)
  // ---------------------------------------------------------------------------
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('O Google não retornou uma credencial válida.')
      return
    }

    setIsLoading(true)
    try {
      const response = await establishUnifiedSession(credentialResponse.credential)
      login(response.token, response.usuario)
      toast.success('Login único realizado em todos os sistemas!')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao realizar login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
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
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
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
          <motion.div variants={fadeUp} className="flex min-h-11 w-full items-center justify-center">
            {isLoading ? (
              <div className="flex w-full items-center justify-center rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-black">
                <Loader2 className="mr-3 h-5 w-5 animate-spin text-black/70" />
                Registrando e autenticando sistemas...
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Falha ao autenticar com o Google.')}
                theme="filled_black"
                size="large"
                shape="pill"
                text="signin_with"
                width="360"
              />
            )}
          </motion.div>

          {/* Divider */}
          <motion.div
            variants={fadeUp}
            className="my-6 h-px w-full bg-gradient-to-r from-transparent via-divider to-transparent"
          />

          {/* Restriction notice */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center justify-center text-xs text-text-muted"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
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
