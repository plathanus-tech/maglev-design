import { CSSProperties, ElementType, ReactNode } from 'react';

type Gap = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface StackProps {
  /** `vertical` empilha (padrão), `horizontal` alinha em linha. */
  direction?: 'vertical' | 'horizontal';
  /** Espaço entre filhos — usa a escala `--spacing-*`. */
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
  /** Elemento HTML renderizado (ex.: `ul`, `section`, `form`). */
  as?: ElementType;
  children?: ReactNode;
  className?: string;
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;

/**
 * Primitivo de layout: espaça filhos com tokens. Use no lugar de CSS de página
 * com `display:flex; gap:…`.
 */
export function Stack({
  direction = 'vertical', gap = 'md', align, justify, wrap = false, as: Tag = 'div', children, className,
}: StackProps) {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'vertical' ? 'column' : 'row',
    gap: `var(--spacing-${gap})`,
    flexWrap: wrap ? 'wrap' : undefined,
    alignItems: align ? ALIGN[align] : undefined,
    justifyContent: justify ? JUSTIFY[justify] : undefined,
  };
  return <Tag className={className} style={style}>{children}</Tag>;
}
