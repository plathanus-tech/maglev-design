import { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { IconDownload } from '@tabler/icons-react';
import { Button, TableColumn, Tooltip, useToast } from '@maglev/ds';
import { Cell, downloadXlsx } from './export-xlsx';
import { formatNumber } from './format';
import { todayIso } from './clock';

/** Texto de uma célula renderizada (o que a pessoa lê na tabela): renderiza fora da tela e lê o texto; irmãos com conteúdo (ex.: nome e subtexto) ficam separados por " · ". */
const SEP = ' · ';
/** Sem os caracteres invisíveis que a tabela usa para não quebrar linha (datas, telefones). */
const clean = (t: string) => t.replace(/[\u2060\u200b\u200c\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const domText = (n: Node): string => {
  if (n.nodeType === 3) return n.textContent ?? '';
  const kids = Array.from(n.childNodes);
  const parts = kids.map((k) => ({ el: k.nodeType === 1, t: domText(k) }));
  const filled = parts.filter((p) => p.el && p.t.trim());
  return filled.length > 1 ? filled.map((p) => p.t.trim()).join(SEP) : parts.map((p) => p.t).join('');
};
/** Um só contêiner fora da tela reaproveitado para todas as células (rápido mesmo com centenas de linhas). */
const makeTextReader = () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  return {
    read: (node: ReactNode): string => {
      if (node == null || node === false || node === true) return '';
      if (typeof node === 'string' || typeof node === 'number') { const t = clean(String(node)); return t === '-' ? '' : t; }
      flushSync(() => root.render(<>{node}</>));
      const text = clean(domText(host));
      return text === '-' ? '' : text;
    },
    done: () => root.unmount(),
  };
};

/**
 * Exportar para Excel (.xlsx) as colunas que a tabela está EXIBINDO (as da "Exibição", na ordem em que aparecem, sem a coluna de ações) para
 * TODOS os registros do filtro/busca atuais (não só a página). O valor de cada célula é o que a pessoa lê na tabela; `overrides` troca por
 * número/valor puro onde faz sentido (ex.: dinheiro em reais, contagens). O chamador só renderiza o botão para quem tem a permissão Exportar.
 */
export function ExportButton<T extends Record<string, unknown>>({ columns, rows, file, sheet, noun, feminine = false, overrides = {}, label }: {
  columns: TableColumn<T>[];
  /** Todos os registros do filtro atual (ou uma função que os monta só na hora de exportar). */
  rows: T[] | (() => T[]);
  /** Nome-base do arquivo (vira `<nome>-AAAA-MM-DD.xlsx`). */
  file: string;
  sheet: string;
  /** [singular, plural] do registro, para o aviso ("12 equipamentos exportados"). */
  noun: [string, string];
  /** Registro feminino: "exportada(s)" em vez de "exportado(s)". */
  feminine?: boolean;
  overrides?: Record<string, (row: T) => Cell>;
  /** Nome acessível (ex.: "Exportar equipamentos para Excel"). */
  label: string;
}) {
  const toast = useToast();
  const exportable = columns.filter((c) => c.sticky !== 'right' && c.type !== 'actions' && c.label);

  const run = () => {
    const list = typeof rows === 'function' ? rows() : rows;
    if (!list.length) { toast.show({ type: 'warning', title: 'Nada para exportar', message: `Nenhum registro corresponde aos filtros aplicados.` }); return; }
    const reader = makeTextReader();
    try {
      const headers = exportable.map((c) => c.label as string);
      const data = list.map((r) => exportable.map((c): Cell => {
        const key = String(c.key);
        if (overrides[key]) return overrides[key](r);
        const raw = (r as Record<string, unknown>)[key];
        if (c.render) return reader.read(c.render(raw, r));
        return typeof raw === 'number' || typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
      }));
      reader.done();
      const name = downloadXlsx(file, todayIso(), sheet, headers, data);
      toast.show({ type: 'success', title: 'Exportação concluída', message: `${formatNumber(data.length)} ${data.length === 1 ? noun[0] + (feminine ? ' exportada' : ' exportado') : noun[1] + (feminine ? ' exportadas' : ' exportados')} em ${name}` });
    } catch {
      reader.done();
      toast.show({ type: 'error', title: 'Não foi possível exportar', message: 'Tente novamente. Se o problema continuar, contate o suporte.' });
    }
  };

  return (
    <Tooltip content="Exportar para Excel" placement="left">
      <Button variant="outline" iconOnly iconLeft={<IconDownload size={16} />} aria-label={label} onClick={run} />
    </Tooltip>
  );
}
