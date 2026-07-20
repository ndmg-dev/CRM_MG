import type { TextareaHTMLAttributes } from 'react';
import * as styles from './Textarea.css';
import { errorText } from './Input.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
  return (
    <div>
      <textarea
        className={cx(styles.textarea, className)}
        aria-invalid={!!error}
        {...props}
      />
      {error ? <p className={errorText}>{error}</p> : null}
    </div>
  );
}
