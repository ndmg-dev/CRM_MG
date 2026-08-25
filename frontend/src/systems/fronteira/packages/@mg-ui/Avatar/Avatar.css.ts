import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  borderRadius: '50%',
  background: vars.color.gold.dim,
  color: vars.color.gold.base,
  fontFamily: vars.font.family.base,
  fontWeight: 600,
  flexShrink: 0,
  userSelect: 'none',
});

export const size = styleVariants({
  sm: { width: 24, height: 24, fontSize: vars.font.size.xs },
  md: { width: 32, height: 32, fontSize: vars.font.size.sm },
  lg: { width: 44, height: 44, fontSize: vars.font.size.md },
});

export const image = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});
