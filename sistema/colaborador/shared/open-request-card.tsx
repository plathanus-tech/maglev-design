import { Badge, Card } from '@maglev/ds';
import { formatDateTime } from '../../admin/shared/format';
import { Request } from '../../assinante/shared/data';
import { useSubDb } from '../../assinante/shared/store';
import { scheduleText, scheduledOf, simpleStatus, technicianOf, useRefs } from './lib';

/**
 * Card de solicitação em aberto para o solicitante (RF001 "Solicitações em aberto" e aviso de duplicidade da RF002): protocolo e
 * status, tipo (semibold), prévia da descrição (2 linhas no celular, 3 no desktop) e data de abertura. O card inteiro leva ao
 * acompanhamento da solicitação. O rodapé mostra atendimento agendado e técnico só quando existem (sem "A definir"); a solicitação não tem prazo.
 */
export function OpenRequestCard({ request: r, href }: { request: Request; href: string }) {
  const db = useSubDb();
  const refs = useRefs();
  const st = simpleStatus(db, refs.base, r);
  const tech = technicianOf(db, r);
  const scheduled = scheduledOf(db, refs.base, r);
  return (
    <a className="ext-link-card" href={href} aria-label={`Acompanhar a solicitação ${r.id}: ${st.label}`}>
      <Card padding="none">
        <div className="ext-item">
          <div className="ext-item-head">
            <span className="ext-item-title">{r.id}</span>
            <Badge status={st.tone} dot>{st.label}</Badge>
          </div>
          <span className="ext-item-type">{refs.requestType(r.problemId)?.name ?? '-'}</span>
          <p className="ext-item-desc">{r.description}</p>
          {/* Rodapé condicional: sem técnico nem agendamento, só a abertura (compacto); senão, divisor e linhas "rótulo: valor" (empilhadas no celular, lado a lado no desktop).
              Com agendamento, atendimento e técnico substituem a abertura */}
          {scheduled || tech ? (
            <div className="ext-item-extra">
              {scheduled && <p className="ext-item-line"><span className="ext-item-line-label">Atendimento:</span> {scheduleText(scheduled)}</p>}
              {tech && <p className="ext-item-line"><span className="ext-item-line-label">Técnico:</span> {tech}</p>}
              {!scheduled && <p className="ext-item-line"><span className="ext-item-line-label">Aberta em:</span> {formatDateTime(r.openedAt)}</p>}
            </div>
          ) : (
            <p className="ext-item-date">Aberta em {formatDateTime(r.openedAt)}</p>
          )}
        </div>
      </Card>
    </a>
  );
}
