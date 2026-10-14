import { ReactNode } from 'react';
import { IconLinkOff, IconLock } from '@tabler/icons-react';
import { Card, EmptyState } from '@maglev/ds';
import { Equipment, Provider, SubDb, Technician, WorkOrder } from '../../assinante/shared/data';
import { providerName, providerOrders } from '../../assinante/shared/prestadores';
import { useSubDb } from '../../assinante/shared/store';
import { param } from '../../assinante/shared/ui';
import { TODAY } from '../../assinante/shared/os-common';
import { formatDate } from '../../admin/shared/format';

/**
 * Peças do Prestador de serviço (link web, sem login - Prestador RF001): o link identifica o prestador (`?p=`) e, se for individual,
 * o técnico (`?tec=`). 💡 P09 a confirmar: link permanente do prestador x link por OS, link individual por técnico e se a empresa vê
 * as OS de todos os seus técnicos. No protótipo: link do prestador (empresa vê todas as OS); com `?tec=` o técnico vê só as suas.
 */
export type LinkState = 'ok' | 'invalid' | 'inactive';

export function useProviderLink(simulated?: 'inactive'): { db: SubDb; provider?: Provider; technician?: Technician; state: LinkState; actorName: string } {
  const db = useSubDb();
  const provider = db.providers.find((p) => p.id === param('p'));
  const technician = provider?.technicians.find((t) => t.id === param('tec'));
  const state: LinkState = !provider ? 'invalid' : provider.status === 'inativo' || simulated === 'inactive' ? 'inactive' : 'ok';
  return { db, provider, technician, state, actorName: technician?.name ?? (provider ? providerName(provider) : '') };
}

/** Mantém a identidade do link (prestador e técnico) ao navegar entre as telas do prestador. */
export const linkTo = (page: string, provider: Pick<Provider, 'id'>, technician?: Pick<Technician, 'id'>, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams({ p: provider.id, ...(technician ? { tec: technician.id } : {}), ...extra });
  return `${page}?${q.toString()}`;
};

/** OS atribuídas ao prestador (Prestador RF101-CTA001): a empresa vê as de todos os técnicos; o link individual só as do técnico. */
export const ordersOfLink = (db: SubDb, provider: Provider, technician?: Technician): WorkOrder[] =>
  providerOrders(db, provider.id).filter((o) => !technician || (o.executor.kind === 'prestador' && o.executor.technician === technician.name));

/** Prioridade (maior primeiro): PRI-1 Emergência … PRI-4 Baixa */
export const priorityRank = (id: string) => Number(id.replace(/\D/g, '')) || 99;

export const unitAddress = (db: SubDb, e?: Equipment) => {
  const u = db.units.find((x) => x.id === e?.unitId);
  return u ? `${u.street}, ${u.number} - ${u.district}, ${u.city}/${u.uf}` : '';
};

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/**
 * Endereço da unidade que abre o mapa (Google Maps) em nova aba. Dentro do card da lista (que já é um link para a OS) usa um
 * elemento com papel de link, para não aninhar âncoras; o clique não abre a OS.
 */
export function AddressLink({ address, inCard }: { address: string; inCard?: boolean }) {
  if (!address) return <>-</>;
  const url = mapsUrl(address);
  const label = "Abrir endereço no Google Maps";
  if (!inCard) return <a className="ext-map-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>{address}</a>;
  const open = () => window.open(url, '_blank', 'noopener,noreferrer');
  return (
    <span
      className="ext-map-link is-quiet" role="link" tabIndex={0} aria-label={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(); } }}
    >{address}</span>
  );
}

/** Acesso bloqueado (RF001-CTA002: prestador inativo não acessa) ou link inválido: empty state sem cartão (padrão ext-empty), no topo da área principal. */
export function BlockedAccess({ state }: { state: Exclude<LinkState, 'ok'> }): ReactNode {
  return (
    <div className="ext-empty is-page">
      <EmptyState
          compact icon={state === 'inactive' ? <IconLock size={32} /> : <IconLinkOff size={32} />} headingLevel={1}
          title={state === 'inactive' ? 'Acesso indisponível' : 'Link inválido ou expirado'}
          description={state === 'inactive'
            ? 'Seu cadastro está inativo. Entre em contato com a empresa que enviou o link para solicitar a reativação do acesso.'
            : 'Este link não está mais disponível. Solicite um novo link à empresa responsável pela OS.'}
        />
    </div>
  );
}

/** Diferença em dias de calendário (AAAA-MM-DD): conta por dia civil em UTC, sem hora nem fuso/horário de verão */
const dayNumber = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };

/** Prazo da OS para o prestador: data + informação relativa. Atrasada em vermelho, vencimento em até 2 dias com atenção, demais neutro; OS encerrada não tem alerta. */
export function dueInfo(o: WorkOrder, base: string | undefined): { tone: 'late' | 'soon' | 'neutral'; text: string; date: string } {
  if (!o.dueAt) return { tone: 'neutral', text: '', date: '—' };
  const date = formatDate(o.dueAt);
  if (base === 'concluido' || base === 'cancelado') return { tone: 'neutral', text: '', date };
  const diff = dayNumber(o.dueAt) - dayNumber(TODAY);   // < 0 vencida · 0 hoje · > 0 faltam N dias
  if (diff < 0) return { tone: 'late', text: `Vencida há ${-diff} ${-diff === 1 ? 'dia' : 'dias'}`, date };
  if (diff <= 2) return { tone: 'soon', text: diff === 0 ? 'Vence hoje' : diff === 1 ? 'Vence amanhã' : `Vence em ${diff} dias`, date };
  return { tone: 'neutral', text: `Vence em ${diff} dias`, date };
}
