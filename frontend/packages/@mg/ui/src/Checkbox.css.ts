import { style } from '@vanilla-extract/css';
import { vars } from './theme.css';

export const root = style({
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: vars.color.bg.surface,
  border: `0.5px solid ${vars.color.border.strong}`,
  borderRadius: vars.radius.xs,
  flexShrink: 0,
  selectors: {
    '&[data-state="checked"]': {
      background: vars.color.gold.base,
      borderColor: vars.color.gold.base,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
    '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const indicator = style({
  display: 'inline-flex',
  color: '#0a0a0a',
});

export const wrapper = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  cursor: 'pointer',
});

export const text = style({
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
});
