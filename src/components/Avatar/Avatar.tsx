import { useState } from 'react';
import { cx } from '../../utils/cx';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Nome completo: gera as iniciais (fallback) e o texto alternativo. */
  name: string;
  /** URL da foto. Se faltar ou falhar, mostra as iniciais. */
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Imagem de perfil circular com fallback de iniciais. */
export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span className={cx(styles.avatar, styles[size])} role="img" aria-label={name}>
      {showImage
        ? <img src={src} alt="" className={styles.img} onError={() => setFailed(true)} />
        : <span className={styles.initials} aria-hidden="true">{initialsOf(name)}</span>}
    </span>
  );
}
