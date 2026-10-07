import { useMemo } from 'react';
import './equipamento.css';

/**
 * QR Code visual e determinístico (SVG) - só para o protótipo (RF305): os 3 marcadores de canto, a linha de
 * sincronismo, o marcador de alinhamento e módulos de dados pseudo-aleatórios gerados a partir do texto.
 * NÃO é lido por câmera; a versão real gera o QR da URL no servidor.
 * Uso: <QrCode value={qrLink(equipamento)} label="QR Code do equipamento X" />. O tamanho vem do contêiner (width 100%).
 */
const N = 25;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Matriz de módulos (true = escuro) a partir do texto. */
export function qrMatrix(text: string): boolean[][] {
  const m: boolean[][] = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  const reserved: boolean[][] = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  const finder = (x0: number, y0: number) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const px = x0 + x, py = y0 + y;
      if (px < 0 || py < 0 || px >= N || py >= N) continue;
      reserved[py][px] = true;
      const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const ring = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[py][px] = inside && (ring || core);
    }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; reserved[6][i] = true; reserved[i][6] = true; }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    const px = N - 7 + x, py = N - 7 + y;
    reserved[py][px] = true;
    m[py][px] = Math.max(Math.abs(x), Math.abs(y)) !== 1;
  }
  const next = rng(hash(text));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!reserved[y][x]) m[y][x] = next() < 0.5;
  return m;
}

export function QrCode({ value, label = 'QR Code' }: { value: string; label?: string }) {
  const cells = useMemo(() => qrMatrix(value), [value]);
  const quiet = 2;
  const size = N + quiet * 2;
  const d = cells.flatMap((row, y) => row.map((on, x) => (on ? `M${x + quiet} ${y + quiet}h1v1h-1z` : ''))).join('');
  return (
    <svg className="qr-code" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} className="qr-bg" />
      <path d={d} className="qr-fg" />
    </svg>
  );
}
