import { IconShieldExclamation } from '@tabler/icons-react';
import { Badge, Feedback, Tooltip } from '@maglev/ds';
import { formatDate } from '../../admin/shared/format';
import type { Equipment, SubDb } from './data';
import { orderCompletedAt } from './prestadores';
import { WarrantyState, daysText, previousServiceHint, warrantyOf } from './warranty';
import './warranty.css';

/** Selo da garantia (detalhe do equipamento e da solicitação): sem garantia · ainda não iniciada · em garantia · vence em N dias (atenção) · expirada. */
export function warrantyBadge(w: Equipment['warranty'], state: WarrantyState = warrantyOf(w)) {
  switch (state.kind) {
    case 'none': return <Badge status="neutral" dot>Sem garantia</Badge>;
    case 'expired': return <Badge status="warning" dot>Garantia expirada</Badge>;
    case 'future': return <Badge status="neutral" dot>Garantia ainda não iniciada</Badge>;
    case 'expiring': return <Badge status={state.urgent ? 'error' : 'warning'} dot>{`Garantia ${daysText(state.daysLeft ?? 0)}`}</Badge>;
    default: return <Badge status="success" dot>Em garantia</Badge>;
  }
}

/** Texto curto da garantia para a solicitação: "Em garantia até 20/06/2027", "Garantia vence em 12 dias (30/11/2026)". */
export function warrantyLine(w: Equipment['warranty']) {
  const s = warrantyOf(w);
  switch (s.kind) {
    case 'none': return 'Sem garantia';
    case 'expired': return `Expirada em ${formatDate(s.end!)}`;
    case 'future': return `Começa em ${formatDate(s.start!)}`;
    case 'expiring': { const t = daysText(s.daysLeft ?? 0); return `${t[0].toUpperCase()}${t.slice(1)} (${formatDate(s.end!)})`; }
    default: return s.end ? `Em garantia até ${formatDate(s.end)}` : 'Em garantia';
  }
}

/** Indicador discreto na lista de equipamentos: só ícone (com dica) quando a garantia vence em até 30 dias; sem coluna a mais. */
export function WarrantyFlag({ warranty }: { warranty: Equipment['warranty'] }) {
  const s = warrantyOf(warranty);
  if (s.kind !== 'expiring') return null;
  const text = `Garantia ${daysText(s.daysLeft ?? 0)}`;
  // Duas faixas, sem fundo sólido: até 30 dias só o ícone (atenção); até 15 dias o ícone fica crítico e mostra os dias restantes
  return (
    <Tooltip content={text} placement="right">
      <span className={`warranty-flag${s.urgent ? ' is-urgent' : ''}`} role="img" aria-label={text} tabIndex={0}>
        <IconShieldExclamation size={16} aria-hidden="true" />
        {s.urgent && <span className="warranty-flag-days" aria-hidden="true">{`${s.daysLeft} ${s.daysLeft === 1 ? 'dia' : 'dias'}`}</span>}
      </span>
    </Tooltip>
  );
}

/** Dica na solicitação "relacionada a reparo anterior": último serviço concluído no equipamento e a garantia de serviço informada pelo prestador. */
export function PreviousServiceNotice({ db, equipmentId }: { db: SubDb; equipmentId: string }) {
  const h = previousServiceHint(db, equipmentId, (o) => orderCompletedAt(db, o));
  if (!h.order) return <Feedback type="info" title="Último serviço neste equipamento" message="Nenhum serviço concluído neste equipamento no histórico" />;
  const who = h.internal ? 'Equipe interna' : `${h.provider ? (h.provider.tradeName ?? h.provider.name) : 'Prestador'}${h.technician ? ` (${h.technician})` : ''}`;
  const when = `concluído em ${formatDate(h.completedAt!)} (${h.ago === 0 ? 'hoje' : h.ago === 1 ? 'há 1 dia' : `há ${h.ago} dias`})`;
  const days = h.provider?.serviceWarranty?.days;
  const warranty = h.internal ? 'Serviço da equipe interna, sem garantia de serviço de prestador.'
    : h.coverage === 'within' ? `Garantia de serviço informada: ${days} dias, dentro do prazo (${h.daysLeft === 0 ? 'último dia' : `restam ${h.daysLeft} ${h.daysLeft === 1 ? 'dia' : 'dias'}`}).`
    : h.coverage === 'outside' ? `Garantia de serviço informada: ${days} dias, fora do prazo (terminou há ${Math.abs(h.daysLeft ?? 0)} ${Math.abs(h.daysLeft ?? 0) === 1 ? 'dia' : 'dias'}).`
    : h.coverage === 'none' ? 'O prestador não oferece garantia de serviço.'
    : 'Garantia de serviço não informada no cadastro do prestador.';
  return <Feedback type="info" title="Último serviço neste equipamento" message={`${h.order.id} · ${who} · ${when}. ${warranty}`} />;
}
