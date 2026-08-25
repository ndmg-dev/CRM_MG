import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const textarea = style({
  width: '100%',
  minHeight: 88,
  padding: vars.space[3],
  fontFamily: vars.font.family.base,
  fontSize: vars.font.size.base,
  lineHeight: 1.6,
  color: vars.color.text.primary,
  background: vars.color.bg.surface,
  border: `0.5px solid ${vars.color.border.default}`,
  borderRadius: vars.radius.md,
  resize: 'vertical',
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
    '&[aria-invalid="true"]': { borderColor: vars.color.status.error },
  },
});
