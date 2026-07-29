import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from './theme.css';

// tudo aqui é checado em build: usar vars.color.gold.xpto que não existe = erro de tipo.
const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  fontFamily: vars.font.family.base,
  fontSize: vars.font.size.base,
  fontWeight: 500,
  lineHeight: 1,
  border: '0.5px solid transparent',
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  transition: 'background 120ms ease, border-color 120ms ease, transform 80ms ease',
  ':active': { transform: 'scale(0.98)' },
  ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${vars.color.gold.base}`,
      outlineOffset: '2px',
    },
  },
});

export const variant = styleVariants({
  primary: [
    base,
    {
      background: vars.color.gold.base,
      color: '#0a0a0a',
      selectors: { '&:hover:not(:disabled)': { background: vars.color.gold.hover } },
    },
  ],
  ghost: [
    base,
    {
      background: vars.color.bg.raised,
      color: vars.color.text.primary,
      borderColor: vars.color.border.default,
      selectors: {
        '&:hover:not(:disabled)': {
          background: vars.color.bg.hover,
          borderColor: vars.color.border.strong,
        },
      },
    },
  ],
  // Destrutivo translúcido (texto + borda vermelhos), como no sistema de ponto.
  // Vermelho sólido pesa demais numa interface desta densidade.
  danger: [
    base,
    {
      background: vars.color.status['error-soft'],
      color: vars.color.status.error,
      borderColor: vars.color.status.error,
      selectors: { '&:hover:not(:disabled)': { background: vars.color.status['error-soft'], filter: 'brightness(1.3)' } },
    },
  ],
});

export const size = styleVariants({
  sm: { height: 30, padding: `0 ${vars.space[3]}`, fontSize: vars.font.size.sm },
  md: { height: 36, padding: `0 ${vars.space[4]}` },
  lg: { height: 44, padding: `0 ${vars.space[5]}`, fontSize: vars.font.size.md },
});
