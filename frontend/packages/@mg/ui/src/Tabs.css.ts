import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const list = style({
  display: 'flex',
  gap: vars.space[4],
  borderBottom: `0.5px solid ${vars.color.border.default}`,
});

export const trigger = style({
  padding: `${vars.space[2]} 0`,
  fontSize: vars.font.size.base,
  fontWeight: 500,
  color: vars.color.text.secondary,
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  marginBottom: -1,
  transition: 'color 120ms ease, border-color 120ms ease',
  selectors: {
    '&[data-state="active"]': {
      color: vars.color.text.primary,
      borderBottomColor: vars.color.gold.base,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
    '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const content = style({
  paddingTop: vars.space[4],
  selectors: {
    '&:focus-visible': { outline: 'none' },
  },
});
