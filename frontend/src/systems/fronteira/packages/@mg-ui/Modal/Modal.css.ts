import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '../theme.css';

/* Animações: o Radix expõe [data-state="open"|"closed"] no Overlay e no Content,
   então dá pra animar entrada/saída sem JS. */
const overlayShow = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const contentShow = keyframes({
  // a centralização (translate -50%,-50%) fica DENTRO do keyframe pra não brigar
  // com o transform da animação.
  from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' },
  to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(2px)',
  selectors: {
    '&[data-state="open"]': {
      animation: `${overlayShow} 0.3s ease`,
    },
  },
});

export const content = style({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90vw',
  maxWidth: '440px',
  maxHeight: '85vh',
  overflowY: 'auto',
  background: vars.color.bg.card,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.lg,
  padding: vars.space[6],
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
  fontFamily: vars.font.family.base,
  selectors: {
    '&[data-state="open"]': {
      animation: `${contentShow} 0.4s cubic-bezier(0.16, 1, 0.3, 1)`,
    },
    '&:focus': { outline: 'none' },
  },
});

export const title = style({
  margin: 0,
  fontSize: vars.font.size.lg,
  fontWeight: 600,
  color: vars.color.text.primary,
});

export const description = style({
  margin: `${vars.space[2]} 0 0`,
  fontSize: vars.font.size.base,
  lineHeight: 1.6,
  color: vars.color.text.secondary,
});

export const body = style({
  marginTop: vars.space[4],
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
});

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: vars.space[2],
  marginTop: vars.space[6],
});

export const close = style({
  position: 'absolute',
  top: vars.space[4],
  right: vars.space[4],
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  color: vars.color.text.secondary,
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: vars.color.bg.hover, color: vars.color.text.primary },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
  },
});
