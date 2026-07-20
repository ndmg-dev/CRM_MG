import { style } from '@vanilla-extract/css';
import { vars } from './theme.css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
});

export const item = style({
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: vars.color.bg.surface,
  border: `0.5px solid ${vars.color.border.strong}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  selectors: {
    '&[data-state="checked"]': { borderColor: vars.color.gold.base },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
    '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const indicator = style({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: vars.color.gold.base,
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
