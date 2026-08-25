import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const label = style({
  display: 'inline-block',
  marginBottom: vars.space[2],
  fontSize: vars.font.size.sm,
  fontWeight: 500,
  color: vars.color.text.secondary,
  selectors: {
    '&[data-disabled]': { opacity: 0.5 },
  },
});
