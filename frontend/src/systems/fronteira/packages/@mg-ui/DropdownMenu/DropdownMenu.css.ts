import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '../theme.css';

const contentShow = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const content = style({
  minWidth: 180,
  background: vars.color.bg.card,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
  padding: vars.space[1],
  zIndex: 50,
  selectors: {
    '&[data-state="open"]': { animation: `${contentShow} 140ms ease` },
  },
});

export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  height: 32,
  padding: `0 ${vars.space[3]}`,
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  outline: 'none',
  selectors: {
    '&[data-highlighted]': { background: vars.color.bg.hover },
    '&[data-disabled]': { color: vars.color.text.muted, pointerEvents: 'none' },
  },
});

export const itemDanger = style({
  selectors: {
    '&[data-highlighted]': { background: vars.color.status.error, color: '#ffffff' },
  },
});

export const separator = style({
  height: 1,
  margin: `${vars.space[1]} 0`,
  background: vars.color.border.default,
});

export const label = style({
  padding: `${vars.space[1]} ${vars.space[3]}`,
  fontSize: vars.font.size.xs,
  color: vars.color.text.muted,
});
