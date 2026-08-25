import { createGlobalThemeContract } from '@vanilla-extract/css';

/**
 * Contrato tipado que REFERENCIA as CSS vars já geradas pelo @fronteira-tokens
 * (tokens.css: --mg-color-gold-base, etc.). O Style Dictionary é o dono
 * dos VALORES; aqui só damos acesso tipado (autocomplete + erro se o token
 * não existir). O mapper reconstrói exatamente o nome da var.
 */
export const vars = createGlobalThemeContract(
  {
    color: {
      gold:   { base: null, hover: null, dim: null },
      bg:     { base: null, surface: null, card: null, hover: null, active: null },
      text:   { primary: null, secondary: null, muted: null },
      border: { default: null, strong: null },
      status: { success: null, warning: null, error: null, info: null },
    },
    radius: { xs: null, sm: null, md: null, lg: null, xl: null },
    space:  { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 8: null },
    font: {
      family: { base: null },
      size: { xs: null, sm: null, base: null, md: null, lg: null, xl: null },
    },
  },
  (_value, path) => `mg-${path.join('-')}`,
);
