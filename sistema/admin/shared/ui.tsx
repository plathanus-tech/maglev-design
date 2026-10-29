import { ComponentProps, MouseEvent, ReactElement, ReactNode, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconCircle, IconCircleCheck, IconCircleX, IconInfoCircle } from '@tabler/icons-react';
import { Badge, Button, Card, Stack, Tooltip } from '@maglev/ds';
import { useIsMobile } from './useMediaQuery';
import {
  ADMIN_USER_STATUS, AdminUserStatus, RECORD_STATUS_LABEL, RecordStatus, SUBSCRIBER_STATUS_BADGE, SUBSCRIBER_STATUS_LABEL, SubscriberStatus, Visual, visualBadge, ONBOARDING_STAGES, OnboardingStage,
} from './data';

/**
 * Atalhos de composição do protótipo - sempre componentes do Storybook como pais/filhos.
 * Única peça de layout própria: `Grid`/`Col`, que aplica o grid de Foundations/Grid
 * (4 · 8 · 12 colunas; gutter 16/24px) - o Storybook não tem componente de grid.
 */

export const subscriberStatusBadge = (s: SubscriberStatus) => <Badge status={SUBSCRIBER_STATUS_BADGE[s]} dot>{SUBSCRIBER_STATUS_LABEL[s]}</Badge>;
/** Etapa de implantação do assinante. */
export const onboardingBadge = (s: OnboardingStage) => { const o = ONBOARDING_STAGES.find((x) => x.value === s) ?? ONBOARDING_STAGES[0]; return <Badge status={o.badge} dot>{o.label}</Badge>; };
export const recordStatusBadge = (s: RecordStatus) => <Badge status={s === 'ativo' ? 'success' : 'neutral'} dot>{RECORD_STATUS_LABEL[s]}</Badge>;
/** Estado de acesso do usuário do Admin: Convite pendente · Ativo · Inativo. */
export const adminUserStatusBadge = (s: AdminUserStatus) => <Badge status={ADMIN_USER_STATUS[s].badge} dot>{ADMIN_USER_STATUS[s].label}</Badge>;
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
export const TableToolbar = ({ search, status, filters, columns, actions }: { search?: ReactNode; status?: ReactNode; filters?: ReactNode; columns?: ReactNode; actions?: ReactNode }) => {
  /* campo visível de 36px dentro de uma área clicável de 44px; clicar na faixa de 4px acima/abaixo aciona o campo */
  const hit = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget.querySelector<HTMLElement>("input, button");
    if (el instanceof HTMLInputElement) el.focus(); else el?.click();
  };
  return (
    <div className={status || filters || columns || actions ? "toolbar-row" : "toolbar-row toolbar-row--search-only"}>
      {search && <div className="toolbar-search" onClick={hit}>{search}</div>}
      {status && <div className="toolbar-status" onClick={hit}>{status}</div>}
      {filters && <div className="toolbar-columns" onClick={hit}>{filters}</div>}
      {columns && <div className="toolbar-columns" onClick={hit}>{columns}</div>}
      {actions && <div className="toolbar-columns" onClick={hit}>{actions}</div>}
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
export function RowAction({ icon, label, target, onClick, disabled, unavailableReason }: {
  icon: ReactElement; label: string; target: string; onClick: () => void; disabled?: boolean;
  /** Ação indisponível neste registro: visual de desabilitado, mas focável (`aria-disabled`) e com o motivo no tooltip e no nome acessível. O clique não executa `onClick`. */
  unavailableReason?: string;
}) {
  if (unavailableReason) {
    return (
      <span className="row-unavailable">
        <Tooltip content={unavailableReason} placement="left">
          <Button
            variant="ghost" size="sm" iconOnly iconLeft={icon} className="btn-unavailable" aria-disabled="true"
            aria-label={`${label} ${target}: ${unavailableReason}`} onClick={() => undefined}
          />
        </Tooltip>
      </span>
    );
  }
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

/**
 * Card de seção de formulário longo. No desktop é só o Card; no mobile (< 768px) vira uma seção recolhível (accordion): tocar no cabeçalho
 * ou na seta abre/fecha, todas começam abertas e ao tentar salvar todas abrem (os erros ficam visíveis e o foco no primeiro campo inválido funciona).
 */
export function FormSection({ actions, className, children, ...rest }: ComponentProps<typeof Card>) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form || !isMobile) return undefined;
    const openAll = () => flushSync(() => setOpen(true));
    form.addEventListener('submit', openAll, true);
    return () => form.removeEventListener('submit', openAll, true);
  }, [isMobile]);

  if (!isMobile) return <Card {...rest} className={className} actions={actions}>{children}</Card>;
  const toggle = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('header') && !t.closest('a, input, select, textarea, [role="combobox"]')) setOpen((v) => !v);
  };
  return (
    // o clique no cabeçalho (inclusive na seta) abre/fecha a seção
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div ref={ref} onClick={toggle}>
      <Card
        {...rest} className={`${className ?? ''} fs-card${open ? '' : ' is-collapsed'}`}
        actions={(
          <>
            {actions}
            <Button variant="ghost" size="sm" iconOnly iconLeft={open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />} aria-label={open ? 'Recolher seção' : 'Expandir seção'} aria-expanded={open} />
          </>
        )}
      >
        {children}
      </Card>
    </div>
  );
}
