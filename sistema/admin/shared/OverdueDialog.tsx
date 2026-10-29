import { ReactNode } from 'react';
import { IconCalendarClock, IconClipboardList, IconQrcode, IconShieldCheck, IconUsers } from '@tabler/icons-react';
import { Button, Card, Dialog, Feedback, Stack, useToast } from '@maglev/ds';
import { DevNote } from './dev-notes/DevNote';
import { Db, SUSPENSION_GRACE_DAYS, Subscriber, subscriberName, subscriberUsers } from './data';
import { addDaysIso, daysText, daysUntil, formatDate, formatNumber } from './format';
import { markOverdue, regularize, useSession } from './store';
import { SectionLabel } from './ui';

/** O que o assinante perde com a inativação do ambiente, em números (para o operador prever o impacto antes de aplicar). */
export function impactOf(db: Db, s: Subscriber) {
  const users = subscriberUsers(s).filter((u) => u.status === 'ativo').length;
  const tickets = db.tickets.filter((t) => t.subscriberId === s.id).length;
  const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
  return {
    users, qr: s.equipments, tickets,
    /** "12 usuários ativos, 34 QR Codes e 3 chamados em aberto" */
    summary: `${plural(users, 'usuário ativo', 'usuários ativos')}, ${plural(s.equipments, 'QR Code', 'QR Codes')} e ${plural(tickets, 'chamado em aberto', 'chamados em aberto')}`,
  };
}

export const countOf = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/**
 * Hierarquia dos modais de inativar ambiente e marcar como inadimplente: o alerta (fora daqui) traz a consequência principal;
 * esta seção lista os impactos operacionais em itens curtos e, separado, o que fica preservado.
 */
export function ImpactSection({ title, items, preserved }: { title: string; items: Array<{ icon: ReactNode; text: ReactNode }>; preserved: { title: string; text: string } }) {
  return (
    <Stack gap="md">
      <Stack gap="sm" as="section">
        <SectionLabel>{title}</SectionLabel>
        {items.map((it, k) => (
          <Stack key={k} direction="horizontal" gap="sm" align="start">
            <span className="impact-icon" aria-hidden="true">{it.icon}</span>
            <span className="impact-text">{it.text}</span>
          </Stack>
        ))}
      </Stack>
      <Card>
        <Stack direction="horizontal" gap="sm" align="start">
          <span className="impact-icon" aria-hidden="true"><IconShieldCheck size={16} /></span>
          <Stack gap="2xs">
            <span className="impact-title">{preserved.title}</span>
            <span className="impact-text">{preserved.text}</span>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}

/**
 * Status manual do assinante (RF201-RGN002): marcar como Inadimplente (abre o prazo de regularização antes de inativar o
 * ambiente e avisa os gestores) ou voltar para Ativo. Não há cobrança nem automação: a inativação continua sendo manual (RF204).
 */
export function OverdueDialog({ subscriber, onClose, onConfirmed }: { subscriber: Subscriber | null; onClose: () => void; /** Chamado depois de aplicar a mudança (ex.: o formulário de edição salva os dados). */ onConfirmed?: () => void }) {
  const toast = useToast();
  const { db, user: me } = useSession();
  if (!subscriber) return null;
  const overdue = subscriber.status === 'inadimplente';
  const name = subscriberName(subscriber);
  const deadline = addDaysIso(SUSPENSION_GRACE_DAYS);

  const confirm = () => {
    if (overdue) {
      regularize(me.id, subscriber);
      toast.show({ type: 'success', title: 'Assinante marcado como ativo', message: 'O aviso de inativação foi removido e o prazo deixou de valer.' });
    } else {
      const at = markOverdue(me.id, subscriber);
      toast.show({ type: 'success', title: 'Assinante marcado como inadimplente', message: `Os gestores foram avisados por e-mail e na plataforma. Prazo para regularizar: até ${formatDate(at)}.` });
    }
    onConfirmed?.();
    onClose();
  };

  return (
    <Dialog
      open onClose={onClose} size="sm" className="dialog-confirm"
      title={overdue ? `Marcar ${name} como ativo?` : `Marcar ${name} como inadimplente?`}
      subtitle={overdue
        ? 'O aviso de inativação será removido e o prazo de regularização deixa de valer'
        : `Os gestores serão avisados e terão ${daysText(SUSPENSION_GRACE_DAYS)} para regularizar antes de o ambiente ser inativado`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={confirm}>{overdue ? 'Marcar como ativo' : 'Marcar como inadimplente'}</Button>
        </>
      )}
    >
      {!overdue && (() => {
        const i = impactOf(db, subscriber);
        return (
          <DevNote note={`Aviso antes da suspensão: ao marcar Inadimplente abre-se o prazo de ${daysText(SUSPENSION_GRACE_DAYS)} (💡 definido por enquanto). Durante o prazo o assinante acessa normalmente; os gestores e administradores dele veem um modal ao entrar e recebem um e-mail com o prazo e o impacto. Passado o prazo, a inativação do ambiente continua manual (RF204), sem automação nem cobrança na plataforma (RF201-RGN002). Os impactos listados são os mesmos da inativação do ambiente.`}>
            <Stack gap="lg">
              <Feedback type="warning" title={`Prazo para regularizar: até ${formatDate(deadline)}`} message="Se a pendência não for resolvida, o ambiente poderá ser inativado" />
              <ImpactSection
                title="Se o ambiente for inativado"
                items={[
                  { icon: <IconUsers size={16} />, text: <><strong>{countOf(i.users, 'usuário ativo', 'usuários ativos')}</strong> perderão o acesso</> },
                  { icon: <IconQrcode size={16} />, text: <><strong>{countOf(i.qr, 'QR Code', 'QR Codes')}</strong> serão bloqueados</> },
                  { icon: <IconClipboardList size={16} />, text: <><strong>{countOf(i.tickets, 'chamado em aberto', 'chamados em aberto')}</strong> ficarão congelados</> },
                ]}
                preserved={{ title: 'Até o fim do prazo, nada muda', text: 'O assinante continua acessando normalmente e nada é excluído. Ao regularizar, ele volta para Ativo e o aviso é removido.' }}
              />
            </Stack>
          </DevNote>
        );
      })()}
    </Dialog>
  );
}

/** Na inativação de um assinante inadimplente: item com o prazo de regularização (em curso ou já vencido) para o operador decidir com contexto. */
export function overdueNoticeItem(subscriber: Subscriber): { icon: ReactNode; text: ReactNode } | null {
  if (subscriber.status !== 'inadimplente' || !subscriber.suspendAt) return null;
  const left = daysUntil(subscriber.suspendAt);
  return {
    icon: <IconCalendarClock size={16} />,
    text: left >= 0
      ? <><strong>Prazo de regularização em andamento:</strong> os gestores têm até {formatDate(subscriber.suspendAt)} ({left === 0 ? 'termina hoje' : `faltam ${daysText(left)}`})</>
      : <><strong>Prazo de regularização encerrado</strong> em {formatDate(subscriber.suspendAt)}, sem regularização</>,
  };
}
