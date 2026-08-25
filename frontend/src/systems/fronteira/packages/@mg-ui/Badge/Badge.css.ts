import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  height: 22,
  padding: `0 ${vars.space[2]}`,
  fontSize: vars.font.size.xs,
  fontWeight: 600,
  borderRadius: vars.radius.xl,
  border: '0.5px solid transparent',
  whiteSpace: 'nowrap',
});

export const variant = styleVariants({
  ok: [base, {
    background: 'rgba(34, 197, 94, 0.10)',
    color: vars.color.status.success,
    borderColor: 'rgba(34, 197, 94, 0.28)',
  }],
  warn: [base, {
    background: 'rgba(245, 158, 11, 0.10)',
    color: vars.color.status.warning,
    borderColor: 'rgba(245, 158, 11, 0.28)',
  }],
  err: [base, {
    background: 'rgba(239, 68, 68, 0.10)',
    color: vars.color.status.error,
    borderColor: 'rgba(239, 68, 68, 0.28)',
  }],
  neutral: [base, {
    background: vars.color.bg.hover,
    color: vars.color.text.secondary,
    borderColor: vars.color.border.default,
  }],
  // Adicionado localmente (não existe no @mg original): destaque com o
  // dourado da marca para ênfase/estado ativo que não é um status
  // (ok/warn/err) — ex.: etapa atual do wizard, papel do usuário. Ver
  // README, seção "Design system @mg" (regra: estender em vez de
  // customizar por fora).
  accent: [base, {
    background: vars.color.gold.dim,
    color: vars.color.gold.base,
  }],
});
