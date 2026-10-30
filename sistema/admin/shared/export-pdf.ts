/**
 * Exportação para PDF sem biblioteca: monta um PDF 1.4 mínimo (A4 paisagem, fonte Helvetica padrão, tabela com cabeçalho repetido em cada página, linhas
 * alternadas, quebra de texto dentro da coluna e rodapé com a página) e baixa o arquivo no navegador. O texto é gravado em WinAnsi (acentos do português);
 * caracteres fora dele viram "?". Sem fontes embutidas; o logo da MAGLEV entra como imagem JPEG (rasterizada do SVG da marca) e o cabeçalho da tabela usa um laranja claro da marca.
 */
import logoUrl from '../../../public/maglev-logo.svg';

export type PdfCell = string | number | null | undefined;

// ── medidas (pontos; A4 paisagem)
const PAGE_W = 842, PAGE_H = 595, MARGIN = 36;
const FONT = 8, HEAD_FONT = 8, LEAD = 10.5, PAD = 4, TITLE_FONT = 14;
const MIN_COL = 38;
const LOGO_H = 26;

/** Identidade da marca no PDF: logo (JPEG) e cor do cabeçalho da tabela (RGB 0–1). */
export type PdfBrand = { company?: string; logo?: { jpeg: Uint8Array; w: number; h: number }; head?: [number, number, number] };

/** Lê a cor da marca do tema (--brand-primary) e devolve o laranja claro do cabeçalho (mesma ideia do token --color-brand-100, um pouco mais firme para o papel). */
function brandHeadColor(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const rgb = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [249, 105, 0];
  return rgb.map((v) => (255 - (255 - v) * 0.2) / 255) as [number, number, number];
}

/** Carrega o logo da MAGLEV e converte para JPEG (fundo branco), que o PDF embute direto. Sem logo se a imagem não carregar. */
async function loadBrand(logoUrl: string): Promise<PdfBrand> {
  const head = brandHeadColor();
  try {
    const img = new Image();
    img.src = logoUrl;
    await img.decode();
    const scale = 3;
    const h = Math.round(LOGO_H * scale), w = Math.round((img.naturalWidth / img.naturalHeight) * h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('jpeg'))), 'image/jpeg', 0.92));
    return { logo: { jpeg: new Uint8Array(await blob.arrayBuffer()), w, h }, head };
  } catch { return { head }; }
}

// Larguras da Helvetica (milésimos de em) para ASCII 32–126; acentuadas usam a letra-base
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BASE: Record<string, string> = { À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E', Ì: 'I', Í: 'I', Î: 'I', Ï: 'I', Ñ: 'N', Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U',
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', ç: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e', ì: 'i', í: 'i', î: 'i', ï: 'i', ñ: 'n', ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ù: 'u', ú: 'u', û: 'u', ü: 'u' };
const SPECIAL: Record<string, number> = { '€': 0x80, '…': 0x85, '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '·': 0xb7, 'º': 0xba, 'ª': 0xaa, '°': 0xb0 };

/** Byte WinAnsi de um caractere (ASCII e Latin-1 direto; alguns tipográficos; o resto "?"). */
const byteOf = (ch: string): number => {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return c;
  if (SPECIAL[ch] !== undefined) return SPECIAL[ch];
  if (c >= 0xa0 && c <= 0xff) return c;
  if (c === 0x2060 || c === 0x200b || c === 0xa0) return 32;
  return 63;
};
const widthOf = (ch: string, size: number, bold: boolean) => {
  const b = BASE[ch] ?? ch;
  const c = b.charCodeAt(0);
  const w = c >= 32 && c <= 126 ? W[c - 32] : 556;
  return (w * (bold ? 1.06 : 1) * size) / 1000;
};
const textWidth = (t: string, size: number, bold = false) => [...t].reduce((n, ch) => n + widthOf(ch, size, bold), 0);

/** Quebra o texto em linhas que cabem em `max` pontos (palavras; palavra longa é cortada). */
function wrap(text: string, max: number, size: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (textWidth(w, size) > max && w.length > 1) {
        // palavra maior que a coluna: corta no que cabe
        let k = w.length - 1;
        while (k > 1 && textWidth(w.slice(0, k), size) > max) k--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, k));
        w = w.slice(k);
      }
      const next = line ? `${line} ${w}` : w;
      if (textWidth(next, size) <= max) line = next;
      else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const bytesOf = (s: string) => Uint8Array.from([...s].map(byteOf));
const lit = (s: string) => {
  const out: number[] = [40];
  for (const b of bytesOf(s)) { if (b === 40 || b === 41 || b === 92) out.push(92); out.push(b); }
  out.push(41);
  return out;
};
const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
const join = (parts: Uint8Array[]) => { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };

/** Monta o PDF da tabela. `meta` = linha abaixo do título (ex.: data e total). */
export function buildPdf(title: string, meta: string, headers: string[], rows: PdfCell[][], brand: PdfBrand = {}): Blob {
  const usable = PAGE_W - MARGIN * 2;
  const cells = rows.map((r) => r.map((v) => (v == null ? '' : String(v))));
  // larguras: cada coluna garante o mínimo para a maior palavra do cabeçalho caber inteira; o que sobra da página é dividido pelo tamanho do conteúdo
  const minW = headers.map((h) => Math.max(MIN_COL, Math.max(...h.split(/s+/).map((w) => textWidth(w, HEAD_FONT, true))) * 1.06 + PAD * 2 + 2));
  const body = headers.map((_, c) => Math.min(220, Math.max(...cells.slice(0, 300).map((r) => textWidth(r[c] ?? '', FONT)), 1)) + PAD * 2);
  const minSum = minW.reduce((x, y) => x + y, 0);
  const spare = Math.max(0, usable - minSum);
  const bodySum = body.reduce((x, y) => x + y, 0);
  const shrink = minSum > usable ? usable / minSum : 1;
  const colW = minW.map((m, c) => m * shrink + spare * (body[c] / bodySum));
  const colX: number[] = []; colW.reduce((x, w) => { colX.push(x); return x + w; }, MARGIN);

  type Page = Uint8Array[];
  const pages: Page[] = [];
  let ops: Uint8Array[] = [];
  let y = 0;
  const push = (s: string) => ops.push(ascii(`${s}\n`));
  const textAt = (x: number, yy: number, t: string, bold: boolean, size: number) => {
    ops.push(ascii(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${num(x)} ${num(yy)} Td `), Uint8Array.from(lit(t)), ascii(' Tj ET\n'));
  };
  // Cabeçalho: o texto de cada coluna quebra em mais de uma linha, se preciso (a negrito é um pouco mais larga: margem de 6%)
  const headLines = headers.map((t, c) => wrap(t, (colW[c] - PAD * 2) / 1.06, HEAD_FONT));
  const headH = Math.max(...headLines.map((l) => l.length)) * LEAD + PAD * 2 - 2;
  const drawHeader = () => {
    const hc = brand.head ?? [0.9, 0.9, 0.9];
    push(`${hc.map(num).join(' ')} rg`); push(`${num(MARGIN)} ${num(y - headH)} ${num(usable)} ${num(headH)} re f`); push('0 g');
    headLines.forEach((ls, c) => ls.forEach((t, k) => textAt(colX[c] + PAD, y - PAD - HEAD_FONT + 1 - k * LEAD, t, true, HEAD_FONT)));
    y -= headH;
  };
  const newPage = (first: boolean) => {
    if (ops.length) pages.push(ops);
    ops = []; y = PAGE_H - MARGIN;
    if (first) {
      if (brand.logo) {
        const lw = (brand.logo.w / brand.logo.h) * LOGO_H;
        if (brand.company) textAt(PAGE_W - MARGIN - textWidth(brand.company, 12, true), y - LOGO_H / 2 - 4, brand.company, true, 12);
        push(`q ${num(lw)} 0 0 ${LOGO_H} ${MARGIN} ${num(y - LOGO_H)} cm /Im1 Do Q`); y -= LOGO_H + 10;
      }
      textAt(MARGIN, y - TITLE_FONT, title, true, TITLE_FONT); y -= TITLE_FONT + 6;
      textAt(MARGIN, y - 9, meta, false, 9); y -= 9 + 12;
    }
    drawHeader();
  };
  newPage(true);
  cells.forEach((r, i) => {
    const lines = r.map((t, c) => wrap(t, colW[c] - PAD * 2, FONT));
    const n = Math.max(...lines.map((l) => l.length));
    const h = n * LEAD + PAD * 2 - 2;
    if (y - h < MARGIN + 18) newPage(false);
    if (i % 2 === 0) { push('0.965 g'); push(`${num(MARGIN)} ${num(y - h)} ${num(usable)} ${num(h)} re f`); push('0 g'); }
    lines.forEach((ls, c) => ls.forEach((t, k) => { if (t) textAt(colX[c] + PAD, y - PAD - FONT + 1 - k * LEAD, t, false, FONT); }));
    y -= h;
  });
  pages.push(ops);
  // rodapé com a página
  const total = pages.length;
  pages.forEach((p, i) => { const t = `Página ${i + 1} de ${total}`; p.push(ascii(`BT /F1 8 Tf ${num(PAGE_W - MARGIN - textWidth(t, 8))} ${num(MARGIN - 14)} Td `), Uint8Array.from(lit(t)), ascii(' Tj ET\n')); });

  // objetos: 1 catálogo · 2 páginas · 3 Helvetica · 4 Helvetica-Bold · depois (página, conteúdo) por página
  const objs: Uint8Array[] = [];
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  objs.push(ascii(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`));
  objs.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objs.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  pages.forEach((p, i) => {
    const stream = join(p);
    objs.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${brand.logo ? ` /XObject << /Im1 ${5 + total * 2} 0 R >>` : ''} >> /Contents ${6 + i * 2} 0 R >>`));
    objs.push(join([ascii(`<< /Length ${stream.length} >>\nstream\n`), stream, ascii('endstream')]));
  });
  if (brand.logo) {
    const { jpeg, w, h } = brand.logo;
    objs.push(join([ascii(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>` + String.fromCharCode(10) + 'stream' + String.fromCharCode(10)), jpeg, ascii(String.fromCharCode(10) + 'endstream')]));
  }
  const out: Uint8Array[] = [ascii('%PDF-1.4\n%âãÏÓ\n')];
  const offsets: number[] = [];
  let pos = out[0].length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const chunk = join([ascii(`${i + 1} 0 obj\n`), o, ascii('\nendobj\n')]);
    out.push(chunk); pos += chunk.length;
  });
  const xref = ['xref', `0 ${objs.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `)].join('\n');
  out.push(ascii(`${xref}\ntrailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return new Blob(out as BlobPart[], { type: 'application/pdf' });
}

/** Baixa o PDF. Devolve o nome final do arquivo (com a data da demonstração). */
export async function downloadPdf(baseName: string, date: string, title: string, meta: string, headers: string[], rows: PdfCell[][], company?: string): Promise<string> {
  const name = `${baseName}-${date}.pdf`;
  const url = URL.createObjectURL(buildPdf(title, meta, headers, rows, { ...(await loadBrand(logoUrl)), company }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
