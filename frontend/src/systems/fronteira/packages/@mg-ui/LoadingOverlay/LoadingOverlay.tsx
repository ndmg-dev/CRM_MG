import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as styles from './LoadingOverlay.css';

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  subtitle?: string;
}

export function LoadingOverlay({ show, message = 'Processando…', subtitle = 'Aguarde um momento' }: LoadingOverlayProps) {
  // Trava o scroll do body enquanto o overlay está visível — reforça que a
  // página está bloqueada, como no loader global do v7.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div className={styles.backdrop} role="alert" aria-busy="true" aria-live="assertive">
      <div className={styles.spinnerRing}>
        <div className={styles.ringTrack} />
        <div className={styles.ringHead} />
      </div>
      <div className={styles.textWrap}>
        <p className={styles.message}>{message}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>,
    document.body,
  );
}
