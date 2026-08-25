import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  width: '100%',
  padding: `${vars.space[6]} ${vars.space[4]}`,
  border: `1.5px dashed ${vars.color.border.strong}`,
  borderRadius: vars.radius.md,
  background: vars.color.bg.surface,
  color: vars.color.text.secondary,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 120ms ease, background 120ms ease',
  selectors: {
    '&:hover': {
      borderColor: vars.color.gold.base,
      background: vars.color.bg.hover,
    },
    '&:focus-visible': {
      outline: 'none',
      borderColor: vars.color.gold.base,
      boxShadow: `0 0 0 3px ${vars.color.gold.dim}`,
    },
    '&[data-disabled="true"]': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const dragging = style({
  borderColor: vars.color.gold.base,
  background: vars.color.gold.dim,
  color: vars.color.text.primary,
});

export const icon = style({
  color: vars.color.text.muted,
  selectors: {
    [`${dragging} &`]: { color: vars.color.gold.base },
  },
});

export const label = style({
  fontSize: vars.font.size.base,
  fontWeight: 500,
  color: vars.color.text.primary,
});

export const sub = style({
  fontSize: vars.font.size.sm,
  color: vars.color.text.muted,
});

export const hiddenInput = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});
