import { style, keyframes } from '@vanilla-extract/css';
import { vars } from './theme.css';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'scale(0.96)' },
  to: { opacity: 1, transform: 'scale(1)' },
});

export const content = style({
  background: vars.color.bg.card,
  border: `0.5px solid ${vars.color.border.default}`,
  color: vars.color.text.primary,
  fontSize: vars.font.size.xs,
  padding: `${vars.space[1]} ${vars.space[2]}`,
  borderRadius: vars.radius.sm,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  zIndex: 60,
  selectors: {
    '&[data-state="delayed-open"]': { animation: `${fadeIn} 120ms ease` },
  },
});

export const arrow = style({
  fill: vars.color.bg.card,
});
