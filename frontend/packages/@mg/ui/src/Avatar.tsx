// @ts-nocheck
import * as RAvatar from '@radix-ui/react-avatar';
import * as styles from './Avatar.css';

interface AvatarProps {
  src?: string;
  /** nome completo — as iniciais são derivadas automaticamente (ex: "Ana Souza" -> "AS") */
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Radix Avatar resolve o problema chato de fallback de imagem: mostra as iniciais
 * enquanto a foto carrega e troca automaticamente se a URL falhar (onError nativo
 * de <img> não cobre isso direito sozinho).
 */
export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  return (
    <RAvatar.Root className={`${styles.root} ${styles.size[size]}`}>
      {src ? <RAvatar.Image className={styles.image} src={src} alt={name} /> : null}
      <RAvatar.Fallback delayMs={src ? 400 : 0}>{initials(name)}</RAvatar.Fallback>
    </RAvatar.Root>
  );
}
