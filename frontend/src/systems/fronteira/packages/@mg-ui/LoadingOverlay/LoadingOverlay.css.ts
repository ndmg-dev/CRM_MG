import { keyframes, style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const spin = keyframes({
  to: { transform: 'rotate(360deg)' },
});

// Overlay que cobre a tela inteira e bloqueia interação enquanto um passo
// assíncrono roda — mesma ideia do #global-loader do Fronteira v7.
export const backdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[6],
  background: 'rgba(6, 8, 14, 0.86)',
  backdropFilter: 'blur(6px)',
  animation: `${fadeIn} 120ms ease`,
});

export const spinnerRing = style({
  position: 'relative',
  width: '3.25rem',
  height: '3.25rem',
});

export const ringTrack = style({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  border: '3px solid rgba(255, 255, 255, 0.1)',
});

export const ringHead = style({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  border: '3px solid transparent',
  borderTopColor: vars.color.gold.base,
  animation: `${spin} 750ms linear infinite`,
});

export const textWrap = style({
  textAlign: 'center',
  maxWidth: '22rem',
  padding: `0 ${vars.space[4]}`,
});

export const message = style({
  color: vars.color.text.primary,
  fontFamily: vars.font.family.base,
  fontWeight: 600,
  fontSize: vars.font.size.md,
  margin: `0 0 ${vars.space[2]}`,
  letterSpacing: '0.01em',
});

export const subtitle = style({
  color: vars.color.text.muted,
  fontFamily: vars.font.family.base,
  fontSize: vars.font.size.sm,
  margin: 0,
});
