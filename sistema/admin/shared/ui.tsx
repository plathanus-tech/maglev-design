import { MouseEvent, ReactElement, ReactNode } from 'react';
import { IconAlertTriangle, IconCircle, IconCircleCheck, IconCircleX, IconInfoCircle } from '@tabler/icons-react';
import { Badge, Button, Stack, Tooltip } from '@maglev/ds';
import {
  RECORD_STATUS_LABEL, RecordStatus, SUBSCRIBER_STATUS_BADGE, SUBSCRIBER_STATUS_LABEL, SubscriberStatus, Visual, visualBadge,
} from './data';

/**
 * Atalhos de composição do protótipo - sempre componentes do Storybook como pais/filhos.
 * Única peça de layout própria: `Grid`/`Col`, que aplica o grid de Foundations/Grid
 * (4 · 8 · 12 colunas; gutter 16/24px) - o Storybook não tem componente de grid.
 */

export const subscriberStatusBadge = (s: SubscriberStatus) => <Badge status={SUBSCRIBER_STATUS_BADGE[s]} dot>{SUBSCRIBER_STATUS_LABEL[s]}</Badge>;
export const recordStatusBadge = (s: RecordStatus) => <Badge status={s === 'ativo' ? 'success' : 'neutral'} dot>{RECORD_STATUS_LABEL[s]}</Badge>;
/**
 * Badge de status (RF407): o ícone substitui o ponto e vem do tipo visual - os mesmos ícones do Feedback para
 * informativo, sucesso, atenção e crítico (erro); neutro usa um círculo.
 */
const STATUS_ICON: Record<Visual, ReactElement> = {
  informativo: <IconInfoCircle size={14} />, sucesso: <IconCircleCheck size={14} />, atencao: <IconAlertTriangle size={14} />,
  critico: <IconCircleX size={14} />, neutro: <IconCircle size={14} />,
};
export const statusBadgeOf = (visual: Visual, label: ReactNode) => <Badge status={visualBadge(visual)} icon={STATUS_ICON[visual]}>{label}</Badge>;
export const visualBadgeOf = (visual: Visual, label: ReactNode) => <Badge status={visualBadge(visual)} dot>{label}</Badge>;

/**
 * Badge de Prioridade/Criticidade. Igual ao Badge padrão no claro; no escuro, os tipos crítico (vermelho) e
 * atenção (laranja) usam fundo e texto mais intensos (page.css, classes .lvl-*).
 */
export const levelBadgeOf = (visual: Visual, label: ReactNode) => {
  const badge = visualBadgeOf(visual, label);
  if (visual !== 'critico' && visual !== 'atencao') return badge;
  return <span className={`lvl lvl-${visual}`}>{badge}</span>;
};

type Span = 3 | 4 | 6 | 8 | 9 | 12;
export const Grid = ({ children, compact }: { children: ReactNode; compact?: boolean }) => <div className={compact ? "grid grid-compact" : "grid"}>{children}</div>;
/** `mobileFull`: no celular (< 480px) ocupa a linha inteira em vez de meia linha. `fill`: o filho (Card) acompanha a altura da linha. */
export const Col = ({ span = 12, mobileFull, fill, children }: { span?: Span; mobileFull?: boolean; fill?: boolean; children: ReactNode }) => (
  <div className={`span-${span}${mobileFull ? ' m-full' : ''}${fill ? ' fill' : ''}`}>{children}</div>
);

/**
 * Campo de visualização (RF203-RGN002: visualização em leitura + "Editar"): só rótulo e texto,
 * sem campo de formulário. Vazio mostra "-".
 */
export function ReadField({ label, value }: { label: string; value?: ReactNode }) {
  const text = value === undefined || value === null || value === '' ? '-' : value;
  return (
    <Stack as="dl" gap="2xs" className="read-field">
      <dt className="read-label">{label}</dt>
      <dd className="read-value">{text}</dd>
    </Stack>
  );
}

/**
 * Célula de tabela com dois dados: o principal e, abaixo, o secundário em hierarquia menor
 * (Body/XS: 12px, cor terciária). Usar sempre que uma célula tiver dois dados (ex.: nome fantasia / razão social).
 */
export const CellPair = ({ primary, secondary }: { primary: ReactNode; secondary: ReactNode }) => (
  <Stack gap="2xs">
    <span>{primary}</span>
    <span className="cell-secondary">{secondary}</span>
  </Stack>
);

/**
 * Barra de busca + filtro(s) + colunas/campos de uma listagem. Desktop: a busca preenche o espaço que sobra (fill) e
 * filtros/colunas ficam à direita. Mobile: busca na linha de cima; filtros e campos lado a lado.
 * Um filtro só: `status` (Dropdown solto). Dois ou mais: `filters` (botão "Filtros" com popover/modal, ver FilterControl).
 */
export const TableToolbar = ({ search, status, filters, columns }: { search?: ReactNode; status?: ReactNode; filters?: ReactNode; columns?: ReactNode }) => {
  /* campo visível de 36px dentro de uma área clicável de 44px; clicar na faixa de 4px acima/abaixo aciona o campo */
  const hit = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget.querySelector<HTMLElement>("input, button");
    if (el instanceof HTMLInputElement) el.focus(); else el?.click();
  };
  return (
    <div className={status || filters || columns ? "toolbar-row" : "toolbar-row toolbar-row--search-only"}>
      {search && <div className="toolbar-search" onClick={hit}>{search}</div>}
      {status && <div className="toolbar-status" onClick={hit}>{status}</div>}
      {filters && <div className="toolbar-columns" onClick={hit}>{filters}</div>}
      {columns && <div className="toolbar-columns" onClick={hit}>{columns}</div>}
    </div>
  );
};

/** Título + texto de apoio de uma área sem Card (ex.: grupo de KPIs). */
export const SectionLabel = ({ id, children }: { id?: string; children: ReactNode }) => <h2 id={id} className="page-label">{children}</h2>;
export const Text = ({ children, center }: { children: ReactNode; center?: boolean }) => <p className={`page-text${center ? ' page-text--center' : ''}`}>{children}</p>;

/**
 * Ação de linha: Button ghost sm só-ícone + Tooltip à esquerda (a coluna fica colada na borda
 * direita; acima, seria cortado). O nome acessível inclui a ação e o registro.
 */
export function RowAction({ icon, label, target, onClick, disabled }: {
  icon: ReactElement; label: string; target: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <Tooltip content={label} placement="left">
      <Button variant="ghost" size="sm" iconOnly iconLeft={icon} aria-label={`${label} ${target}`} onClick={onClick} disabled={disabled} />
    </Tooltip>
  );
}
export const RowActions = ({ children }: { children: ReactNode }) => <Stack direction="horizontal" gap="2xs" align="center">{children}</Stack>;

export const param = (name: string) => new URLSearchParams(location.search).get(name);
export const goTo = (href: string) => { window.location.href = href; };

/** Miniaturas do navegador de protótipo abrem as telas com `thumb=1`: não consomem o aviso pendente. */
const IS_THUMB = new URLSearchParams(location.search).has('thumb');

/** Aviso para o Toast após voltar de outra tela (ex.: salvar → detalhe). */
type Flash = { type: 'success' | 'info' | 'warning' | 'error'; title: string; message: string };
const FLASH_KEY = 'maglev.v2.flash';
export const setFlash = (msg: Flash) => { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify(msg)); } catch { /* sem storage */ } };
export const takeFlash = (): Flash | null => {
  if (IS_THUMB) return null;
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw) as Flash;
  } catch { return null; }
};
