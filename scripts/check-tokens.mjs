#!/usr/bin/env node
/**
 * Falha se algum CSS/TSX de componente ou de produto usar valores visuais fixos
 * em vez de tokens. Rode com:  npm run check:tokens
 *
 * Regras (em arquivos .css e .tsx/.ts, exceto src/tokens/ e *.stories.tsx):
 *  - cor literal: #hex, rgb(), rgba(), hsl(), hsla()
 *  - font-family que não use var(--font-*) nem inherit
 *  - font-size em px/rem/em literal
 *  - border-radius em px/rem literal (0, 50% e var() são permitidos)
 *
 * Exceção pontual: adicione `/* token-ok *\/` (CSS) ou `// token-ok` (TSX) na mesma linha.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const IGNORE_DIRS = [`${sep}tokens${sep}`];

const rules = [
  { name: 'cor literal', re: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/ },
  { name: 'font-family fixa', re: /font-family\s*:\s*(?![\s]|var\(--font-|inherit)/ },
  { name: 'font-size literal', re: /font-size\s*:\s*[\d.]+(?:px|rem|em)\b/ },
  { name: 'border-radius literal', re: /border-radius\s*:\s*[\d.]+(?:px|rem)\b/ },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter(f =>
  /\.(css|tsx?)$/.test(f) &&
  !f.endsWith('.stories.tsx') &&
  !f.endsWith('.d.ts') &&
  !IGNORE_DIRS.some(d => f.includes(d)),
);

let problems = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('token-ok')) return;
    for (const rule of rules) {
      if (rule.re.test(line)) {
        problems++;
        console.error(`${relative(ROOT, file)}:${i + 1}  ${rule.name}  →  ${line.trim()}`);
      }
    }
  });
}

if (problems > 0) {
  console.error(`\n✖ ${problems} valor(es) fixo(s). Use tokens de src/tokens/tokens.css (veja TOKENS.md).`);
  process.exit(1);
}
console.log(`✔ Nenhum valor visual fixo em ${files.length} arquivos.`);
