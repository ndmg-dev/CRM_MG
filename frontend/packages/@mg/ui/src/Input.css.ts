import { style } from '@vanilla-extract/css';
import { vars } from './theme.css';

export const input = style({
  width: '100%',
  height: 36,
  padding: `0 ${vars.space[3]}`,
  fontFamily: vars.font.family.base,
  fontSize: vars.font.size.base,
  color: vars.color.text.primary,
  background: vars.color.bg.surface,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  transition: 'border-color 120ms ease',
  selectors: {
    '&::placeholder': { color: vars.color.text.muted },
    '&:hover': { borderColor: vars.color.border.strong },
    '&:focus-visible': {
      outline: 'none',
      borderColor: vars.color.gold.base,
      boxShadow: `0 0 0 3px ${vars.color.gold.dim}`,
    },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
    // aplicado via aria-invalid, não precisa de prop extra de estilo
    '&[aria-invalid="true"]': {
      borderColor: vars.color.status.error,
    },
  },
});

export const errorText = style({
  marginTop: vars.space[1],
  fontSize: vars.font.size.xs,
  color: vars.color.status.error,
});
