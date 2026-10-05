import { CSSProperties, useEffect, useRef, useState } from 'react';

export type Device = 'desktop' | 'mobile';

/** Marca a URL como miniatura (`thumb=1`, antes do hash): a tela não consome avisos pendentes. */
const asThumb = (src: string) => { const [path, hash] = src.split('#'); return `${path}${path.includes('?') ? '&' : '?'}thumb=1${hash ? `#${hash}` : ''}`; };
export const DEVICE_PRESETS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Miniatura viva: iframe da própria tela, escalado e montado só quando aparece na árvore. */
export function Thumb({ src, device, size, onHover, onLeave, onClick }: {
  src: string;
  device: Device;
  /** Lado da miniatura em px. */
  size: number;
  onHover: (rect: DOMRect) => void;
  onLeave: () => void;
  /** Abre a tela (atalho de mouse; pelo teclado, o rótulo ao lado já é o botão). */
  onClick: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || visible) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()),
      { rootMargin: '200px' },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [visible]);

  const { width, height } = DEVICE_PRESETS[device];
  const scale = Math.min(size / width, size / height);
  const frameStyle = {
    '--thumb-w': `${width}px`,
    '--thumb-h': `${height}px`,
    '--thumb-scale': scale,
    '--thumb-x': `${(size - width * scale) / 2}px`,
    '--thumb-y': `${(size - height * scale) / 2}px`,
  } as CSSProperties;
  const boxStyle = { '--thumb-size': `${size}px` } as CSSProperties;

  return (
    <div
      ref={boxRef}
      className="pn-thumb"
      style={boxStyle}
      onMouseEnter={() => boxRef.current && onHover(boxRef.current.getBoundingClientRect())}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {visible && <iframe key={`${src}|${device}`} className="pn-thumb-frame" style={frameStyle} src={asThumb(src)} tabIndex={-1} aria-hidden="true" title="" />}
    </div>
  );
}

/** Prévia maior ao passar o mouse sobre a miniatura. */
export function HoverPreview({ src, device, rect }: { src: string; device: Device; rect: DOMRect }) {
  const { width, height } = DEVICE_PRESETS[device];
  const previewWidth = 260;
  const scale = previewWidth / width;
  const clipped = Math.min(height * scale, 380);
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - clipped - 16));
  const style = {
    top, left: rect.right + 12,
    '--prev-w': `${previewWidth}px`, '--prev-h': `${clipped}px`,
    '--thumb-w': `${width}px`, '--thumb-h': `${height}px`, '--thumb-scale': scale,
  } as CSSProperties;

  return (
    <div className="pn-hover-preview" style={style} aria-hidden="true">
      <iframe className="pn-hover-frame" src={asThumb(src)} tabIndex={-1} title="" />
    </div>
  );
}
