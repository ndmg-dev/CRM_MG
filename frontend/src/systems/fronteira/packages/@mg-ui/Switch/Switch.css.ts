import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const root = style({
  width: 38,
  height: 22,
  padding: 2,
  background: vars.color.bg.hover,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.xl,
  position: 'relative',
  cursor: 'pointer',
  transition: 'background 150ms ease',
  selectors: {
    '&[data-state="checked"]': { background: vars.color.gold.base },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
    '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  },
});

export const thumb = style({
  display: 'block',
  width: 16,
  height: 16,
  background: '#ffffff',
  borderRadius: '50%',
  transition: 'transform 150ms ease',
  transform: 'translateX(0)',
  selectors: {
    '&[data-state="checked"]': { transform: 'translateX(16px)' },
  },
});
