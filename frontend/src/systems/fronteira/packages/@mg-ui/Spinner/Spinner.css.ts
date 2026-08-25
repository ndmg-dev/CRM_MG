import { keyframes, style, styleVariants } from '@vanilla-extract/css';

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

const base = style({
  display: 'inline-block',
  borderRadius: '50%',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRightColor: 'transparent',
  opacity: 0.85,
  animation: `${spin} 700ms linear infinite`,
  flexShrink: 0,
});

export const size = styleVariants({
  sm: [base, { width: 12, height: 12 }],
  md: [base, { width: 16, height: 16 }],
  lg: [base, { width: 22, height: 22 }],
});
