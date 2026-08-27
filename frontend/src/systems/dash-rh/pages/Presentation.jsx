import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import Loader from '../components/ui/Loader';
import { BarChart2, DollarSign, Clock, Target, AlertTriangle, Zap, Bookmark, Clipboard } from 'react-feather';

/**
 * Splash Screen Animation Component
 */
const SplashScreen = ({ onComplete }) => {
  const content = (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, #c9a84c 0%, transparent 60%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <img 
          src="/logo.png" 
          alt="Mendonça Galvão" 
          style={{ 
            height: '160px', 
            filter: 'brightness(1.2) drop-shadow(0px 20px 30px rgba(0,0,0,0.5))',
            objectFit: 'contain'
          }} 
        />
      </motion.div>

      {/* Premium progress bar */}
      <motion.div
        style={{
          width: '280px',
          height: '2px',
          background: 'rgba(255,255,255,0.05)',
          marginTop: 'var(--space-3xl)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '2px',
          zIndex: 1
        }}
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ delay: 0.5, duration: 1.8, ease: 'easeInOut' }}
          onAnimationComplete={() => setTimeout(onComplete, 600)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, #c9a84c, #fff, #c9a84c)',
            boxShadow: '0 0 15px #c9a84c'
          }}
        />
      </motion.div>
    </motion.div>
  );

  return createPortal(content, document.querySelector('.dash-rh-root') || document.body);
};

/**
 * Tab 6: Presentation Mode — Executive storytelling view.
 * API returns: { story_cards: [{title, body, category, metric, value}], key_findings: [...], recommendations: [...] }
 */
export default function Presentation({ data, loading }) {
  const [showSplash, setShowSplash] = useState(true);

  if (loading || !data) return <Loader size="lg" text="Preparando apresentação..." />;

  const storyCards = [
    ...(data.story_cards || []),
    ...(data.benefits_insights?.insights || [])
  ];
  const keyFindings = data.key_findings || [];
  const recommendations = [
    ...(data.recommendations || []),
    ...(data.benefits_insights?.recommendations || [])
  ];

  const CategoryIcon = ({ category }) => {
    const icons = {
      overview: BarChart2, salary: DollarSign, tenure: Clock,
      expectations: Target, risk: AlertTriangle, insight: Zap,
    };
    const Icon = icons[category] || Bookmark;
    return <Icon size={24} />;
  };

  const categoryColor = (category) => {
    if (category === 'risk') return 'var(--negative)';
    if (category === 'insight') return 'var(--gold)';
    if (category === 'expectations') return 'var(--positive)';
    return 'var(--gold)';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.98 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: 'spring', stiffness: 70, damping: 15 } 
    },
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {!showSplash && (
        <motion.div 
          className="presentation"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Story Cards */}
          {storyCards.map((card, i) => (
            <motion.div 
              key={i} 
              variants={itemVariants}
              viewport={{ once: true, margin: '-50px' }}
              whileInView="show"
              initial="hidden"
            >
              <GlassCard goldAccent className="presentation__slide">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <span style={{ display: 'flex', color: categoryColor(card.category) }}>
                    <CategoryIcon category={card.category} />
                  </span>
                  <span className="heading-sm" style={{ color: categoryColor(card.category) }}>
                    {card.category?.toUpperCase() || 'INSIGHT'}
                  </span>
                </div>
                <h3 className="presentation__title">{card.title}</h3>
                {card.value && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                    viewport={{ once: true }}
                    className="presentation__metric"
                  >
                    {card.value}
                  </motion.div>
                )}
                <p className="presentation__body">{card.body || card.insight}</p>
              </GlassCard>
            </motion.div>
          ))}

          {/* Key Findings */}
          {keyFindings.length > 0 && (
            <motion.div 
              variants={itemVariants} 
              viewport={{ once: true, margin: '-50px' }}
              whileInView="show"
              initial="hidden"
            >
              <GlassCard style={{ padding: 'var(--space-xl)' }}>
                <h3 className="presentation__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clipboard size={24} color="var(--text-secondary)" /> Principais Descobertas
                </h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {keyFindings.map((finding, i) => (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      viewport={{ once: true }}
                      style={{
                        display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start',
                        padding: 'var(--space-sm) 0',
                        borderBottom: '1px solid var(--glass-border)',
                      }}
                    >
                      <span className="text-gold font-mono" style={{ fontWeight: 700, flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
                        {finding}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <motion.div 
              variants={itemVariants} 
              viewport={{ once: true, margin: '-50px' }}
              whileInView="show"
              initial="hidden"
            >
              <GlassCard goldAccent style={{ padding: 'var(--space-xl)' }}>
                <h3 className="presentation__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={24} color="var(--gold)" /> Recomendações Estratégicas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  {recommendations.map((rec, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15 }}
                      viewport={{ once: true }}
                      style={{
                        display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start',
                        padding: 'var(--space-md)',
                        background: 'var(--gold-glow)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(212, 175, 55, 0.1)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--gold)' }}>
                        <Zap size={20} />
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                        {rec}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}
