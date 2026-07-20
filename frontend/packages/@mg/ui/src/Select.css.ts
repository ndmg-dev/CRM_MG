import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '../theme.css';

const contentShow = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const trigger = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  minWidth: 200,
  height: 36,
  padding: `0 ${vars.space[3]}`,
  fontFamily: vars.font.family.base,
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
  background: vars.color.bg.surface,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  transition: 'border-color 120ms ease, background 120ms ease',
  selectors: {
    '&:hover': { borderColor: vars.color.border.strong },
    // Radix marca o trigger com [data-placeholder] enquanto nada foi escolhido
    '&[data-placeholder]': { color: vars.color.text.muted },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
    '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const icon = style({
  color: vars.color.text.secondary,
  display: 'inline-flex',
});

export const content = style({
  // acompanha a largura do trigger (var exposta pelo Radix no modo popper)
  width: 'var(--radix-select-trigger-width)',
  maxHeight: 'var(--radix-select-content-available-height)',
  background: vars.color.bg.card,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
  overflow: 'hidden',
  zIndex: 50,
  selectors: {
    '&[data-state="open"]': {
      animation: `${contentShow} 140ms ease`,
    },
  },
});

export const viewport = style({
  padding: vars.space[1],
});

export const item = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  height: 32,
  paddingLeft: 28,
  paddingRight: vars.space[3],
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  userSelect: 'none',
  outline: 'none',
  selectors: {
    // data-highlighted = item sob foco de teclado OU mouse (o Radix unifica)
    '&[data-highlighted]': {
      background: vars.color.bg.hover,
    },
    '&[data-state="checked"]': {
      color: vars.color.gold.base,
    },
    '&[data-disabled]': {
      color: vars.color.text.muted,
      pointerEvents: 'none',
    },
  },
});

export const itemIndicator = style({
  position: 'absolute',
  left: 6,
  width: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.gold.base,
});

export const scrollButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 24,
  background: vars.color.bg.card,
  color: vars.color.text.secondary,
  cursor: 'default',
});
