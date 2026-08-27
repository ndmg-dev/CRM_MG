import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to `end` using requestAnimationFrame.
 *
 * @param {object} props
 * @param {number} props.end — target value
 * @param {number} [props.duration=1200] — animation duration in ms
 * @param {string} [props.prefix=''] — text before the number (e.g. "R$")
 * @param {string} [props.suffix=''] — text after the number (e.g. "%")
 * @param {number} [props.decimals=0] — decimal places
 * @param {string} [props.className='']
 */
export default function AnimatedCounter({
  end,
  duration = 1200,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  onComplete,
}) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (end == null || isNaN(end)) return;

    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(eased * end);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(current);

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
