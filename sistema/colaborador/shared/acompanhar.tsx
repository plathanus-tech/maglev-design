import { useEffect, useMemo, useRef, useState } from 'react';
import { IconAlertTriangle, IconArrowLeft, IconCircleCheck, IconCopy } from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, Feedback, ImageUpload, RadioButton, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDateTime, requiredMessage } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { Request, nowLocal } from '../../assinante/shared/data';
import { ShareButton } from '../../assinante/shared/share-button';
import { STO, applyOrderValidation } from '../../assinante/shared/os-common';
import { STS } from '../../assinante/shared/solicitacoes-shared';
import { logEntry, notify, updateSubDb, useSubDb } from '../../assinante/shared/store';
import { goTo, param } from '../../assinante/shared/ui';
import { linkToEquipment, linkToRequestByToken, orderOfRequest, publicTokenOf, publicHistoryOf, scheduleText, scheduledOf, simpleStatus, technicianOf, useRefs } from './lib';

/**
 * Estados: idle · complement (pedido de informação) · validate (aguardando a confirmação "O problema foi resolvido?") · resolvedok e unresolved
 * (demonstração do resultado já registrado, com o toast; só visão, nada é gravado) · notfound
 */
const STATES = ['idle', 'complement', 'validate', 'resolvedok', 'unresolved', 'notfound'] as const;
type Mode = (typeof STATES)[number];

/**
 * Acompanhar solicitação e confirmar resolução (Colaborador RF004): protocolo, status simplificado, histórico em linguagem simples,
 * resposta ao pedido de complementação (FLU003) e validação "O problema foi resolvido?" (FLU004/FLU005). Sem login: o link do
 * protocolo é o acesso (RGN007) e, se encaminhado a um colega, a validação fica em nome do solicitante original (RGN005).
 */
function AcompanharScreen() {
  const db = useSubDb();
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  // Link de acompanhamento (?t=, token público) ou consulta pelo protocolo (?p=)
  const token = param('t');
  const request = token ? db.requests.find((r) => publicTokenOf(r.id) === token) : db.requests.find((r) => r.id === param('p'));
  const shell = (content: React.ReactNode) => <ExternalLayout area="Acompanhamento">{content}</ExternalLayout>;

  if (!request || mode === 'notfound') {
    return shell(
      <div className="ext-empty is-center is-warning">
        <EmptyState compact icon={<IconAlertTriangle size={32} />} headingLevel={1} title="Solicitação não encontrada" description="Confira o protocolo ou o link recebido. Se precisar de ajuda, procure o responsável pela unidade." />
      </div>,
    );
  }
  return shell(<Tracking request={request} mode={mode} />);
}

/** Mensagens de sucesso ao registrar a confirmação (RF004-FLU004/FLU005): o toast é temporário, o resultado fica no status e no histórico. */
const VALIDATION_TOAST = {
  sim: { title: 'Atendimento concluído', message: 'Sua confirmação foi registrada.' },
  nao: { title: 'Resposta registrada', message: 'Informamos que o problema não foi resolvido.' },
} as const;

function Tracking({ request: r0, mode }: { request: Request; mode: Mode }) {
  const realDb = useSubDb();
  const toast = useToast();
  const refs = useRefs();
  const demo = mode === 'resolvedok' ? 'sim' : mode === 'unresolved' ? 'nao' : null;
  // Variantes do navegador: aplicam o resultado só na visão (sem gravar), para ver o estado depois do envio sem refazer o fluxo
  const db = useMemo(() => {
    if (!demo) return realDb;
    return {
      ...realDb,
      orders: realDb.orders.map((o) => (o.requestId !== r0.id || !o.validation || o.validation.result ? o : {
        ...o,
        statusId: demo === 'sim' ? STO.CONCLUIDA : STO.ANDAMENTO,
        validation: { ...o.validation, result: demo as 'sim' | 'nao', at: nowLocal(), comment: demo === 'nao' ? 'O freezer voltou a esquentar no mesmo dia.' : undefined },
      })),
    };
  }, [realDb, demo, r0.id]);
  const r = db.requests.find((x) => x.id === r0.id) ?? r0;
  const shown = useRef(false);
  useEffect(() => {
    if (!demo || shown.current) return;
    shown.current = true;
    toast.show({ type: 'success', ...VALIDATION_TOAST[demo] });
  }, [demo, toast]);
  const eq = db.equipments.find((e) => e.id === r.equipmentId);
  const order = orderOfRequest(db, r);
  const st = simpleStatus(db, refs.base, r);
  const tech = technicianOf(db, r);
  const scheduled = scheduledOf(db, refs.base, r);
  // Mensagem de encaminhamento só enquanto a solicitação está em atendimento (depois da conclusão ou da confirmação ela é etapa antiga)
  const forwarded = st.label === 'Em atendimento' && (!!order || r.statusId === STS.APPROVED || r.statusId === STS.CONVERTED);
  const concluded = st.label === 'Concluída';
  const justSent = param('novo') === '1';
  const awaitingInfo = !!r.complement && !r.complement.answeredAt && r.statusId === STS.WAITING;
  const awaitingValidation = !!order && order.statusId === STO.VALIDACAO && !!order.validation && !order.validation.result;

  if (justSent) return <SentCard request={r} />;
  return (
    <Stack gap="lg">
      <PageHeader title={`Solicitação ${r.id}`} subtitle={eq ? `${eq.name} · ${db.units.find((u) => u.id === eq.unitId)?.name ?? ''}` : undefined} iconActions={<ShareButton kind="solicitacao" id={r.id} url={linkToRequestByToken(r.id)} />} />


      <DevNote note="Colaborador RF004-FLU002 / RGN002: o solicitante vê o problema que registrou (tipo e descrição completa), o status e a abertura; técnico responsável (só o nome) e atendimento agendado (a “Previsão de atendimento” da especificação, só quando há data e horário agendados); sem responsável da triagem, prazo, empresa prestadora, contatos, custos nem dados internos. O status usa o mapeamento simplificado da RGN002, sobre o mesmo status da tela administrativa (ex.: Em triagem = Em análise para o solicitante; Convertida em OS e Aprovada = Em atendimento). A mensagem de encaminhamento só aparece quando a solicitação foi aprovada ou virou OS.">
        <Card>
          <Stack gap="md">
            <div className="ext-sit-head">
              <span className="ext-field-label">Situação atual</span>
              <Badge status={st.tone} dot>{st.label}</Badge>
            </div>
            <div className="ext-field">
              <span className="ext-sit-type">{refs.requestType(r.problemId)?.name ?? '-'}</span>
              <p className="ext-sit-desc">{r.description}</p>
            </div>
            {forwarded && <p className="ext-note">Sua solicitação foi aprovada e encaminhada para manutenção.</p>}
            <div className="ext-pair-fit">
              <div className="ext-field"><span className="ext-field-label">Protocolo</span><span className="ext-sit-value">{r.id}</span></div>
              <div className="ext-field"><span className="ext-field-label">Aberta em</span><span className="ext-sit-value">{formatDateTime(r.openedAt)}</span></div>
              {(tech || !concluded) && <div className="ext-field"><span className="ext-field-label">Técnico responsável</span><span className="ext-sit-value">{tech || 'A definir'}</span></div>}
              {(scheduled || !concluded) && <div className="ext-field"><span className="ext-field-label">Atendimento agendado</span><span className="ext-sit-value">{scheduled ? scheduleText(scheduled) : 'Ainda não agendado'}</span></div>}
            </div>
          </Stack>
        </Card>
      </DevNote>

      {(awaitingInfo || mode === 'complement') && r.complement && !r.complement.answeredAt && <ComplementCard request={r} />}
      {r.complement?.answeredAt && (
        <Feedback type="success" title="Resposta enviada" message="Recebemos a sua informação e a solicitação voltou para análise" />
      )}
      {(awaitingValidation || mode === 'validate') && order?.validation && !order.validation.result && <ValidationCard orderId={order.id} />}

      <Card title="Histórico" subtitle="Acompanhe o andamento da solicitação">
        <ol className="ext-history">
          {publicHistoryOf(db, r).map((h, i) => (
            <li key={`${h.at}-${i}`} className="ext-history-item" data-tone={h.tone}>
              <span className="ext-history-text">{h.text}</span>
              <span className="ext-history-date">{formatDateTime(h.at)}</span>
              {h.detail && <span className="ext-history-detail">{h.detail}</span>}
            </li>
          ))}
        </ol>
      </Card>

      {eq && (
        <div className="ext-actions">
          <Button variant="secondary" iconLeft={<IconArrowLeft size={20} />} onClick={() => goTo(linkToEquipment(eq))}>Voltar ao equipamento</Button>
        </div>
      )}
    </Stack>
  );
}

/**
 * Confirmação do envio (Colaborador RF002-FLU007 / CTA002), tela própria (sem situação nem histórico; o acompanhamento é outra tela): protocolo à vista e o link próprio de acompanhamento, que permite voltar depois
 * sem login. Acompanhar abre o mesmo link sem o aviso; Copiar link copia a URL completa (toast).
 */
function SentCard({ request }: { request: Request }) {
  const toast = useToast();
  const href = linkToRequestByToken(request.id);
  const url = new URL(href, window.location.href).href;
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const t = document.createElement('textarea');
        t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(t);
        if (!ok) throw new Error('copy');
      }
      toast.show({ type: 'success', title: 'Link copiado', message: 'O endereço de acompanhamento foi copiado.' });
    } catch {
      toast.show({ type: 'error', title: 'Não foi possível copiar o link', message: 'Selecione o endereço da página e copie manualmente.' });
    }
  };
  return (
    <DevNote note="Colaborador RF002-FLU007 / CTA002: o link usa um token público (não só o número do protocolo) e abre esta mesma tela de acompanhamento, sem login, quantas vezes o solicitante quiser. PROTÓTIPO: o token é derivado do protocolo e a URL é a do ambiente de demonstração; em produção o token é aleatório, gerado no servidor, e a URL é a pública do sistema. 💡 Validade/expiração do link: não definida na especificação, pendente de validação. 💡 O envio do protocolo e do link por WhatsApp depende de FE002 (a negociar).">
      <div className="ext-empty is-center is-success">
          <EmptyState
            compact icon={<IconCircleCheck size={32} />} headingLevel={1} title="Solicitação enviada!"
            description="Guarde o protocolo ou copie o link para acompanhar sua solicitação."
            action={(
              <Stack gap="md" align="center">
                <span className="ext-protocol"><span className="ext-field-label">Protocolo</span><strong>{request.id}</strong></span>
                <div className="ext-sent-actions">
                  <Button onClick={() => goTo(href)}>Acompanhar solicitação</Button>
                  <Button variant="secondary" iconLeft={<IconCopy size={20} />} onClick={copy}>Copiar link</Button>
                </div>
              </Stack>
            )}
        />
      </div>
    </DevNote>
  );
}

/** Pedido de complementação da triagem (RF004-FLU003): texto e/ou foto; ao responder, a solicitação volta para triagem. */
function ComplementCard({ request }: { request: Request }) {
  const [answer, setAnswer] = useState('');
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const error = tried && !answer.trim() && !photo ? 'Escreva uma resposta ou adicione uma foto para continuar.' : undefined;
  const onFile = (file: File | null) => {
    if (!file) { setPhoto(null); return; }
    setLoading(true);
    window.setTimeout(() => { setPhoto({ name: file.name, url: URL.createObjectURL(file) }); setLoading(false); }, 600);
  };
  const send = () => {
    setTried(true);
    if (!answer.trim() && !photo) return;
    const now = nowLocal();
    updateSubDb((d) => ({
      ...d,
      requests: d.requests.map((x) => (x.id !== request.id ? x : {
        ...x, statusId: STS.TRIAGE, statusChangedAt: now,
        complement: { ...x.complement!, answer: answer.trim() || undefined, answerPhoto: photo?.name, answeredAt: now },
        log: [...x.log, logEntry(x.requesterName, 'Respondeu ao pedido de complementação')],
      })),
    }));
    notify([request.responsibleId ?? ''], { title: 'Resposta à complementação', text: `${request.id}: o solicitante respondeu ao pedido de informação`, href: `solicitacao.html?id=${request.id}`, kind: 'solicitacao' });
  };
  return (
    <DevNote note="Colaborador RF004-FLU003 / CTA003: se a triagem pediu complementação, o solicitante vê o pedido e responde (texto e/ou foto); a solicitação volta para triagem e a resposta aparece lá.">
      <Card title="Precisamos de uma informação">
        <Stack gap="md">
          <Feedback type="info" title={request.complement!.question} message={`Solicitado em ${formatDateTime(request.complement!.askedAt)}`} />
          <Textarea label="Sua resposta" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} error={error} />
          <ImageUpload label="Foto" fileName={photo?.name} previewUrl={photo?.url} loading={loading} onChange={onFile} />
          <p className="ext-hint">Preencha uma resposta ou adicione uma foto.</p>
          <div className="ext-actions"><Button onClick={send}>Enviar resposta</Button></div>
        </Stack>
      </Card>
    </DevNote>
  );
}

/** "O problema foi resolvido?" (RF004-FLU004/FLU005): Sim encerra OS e solicitação; Não devolve a OS ao responsável com o comentário. */
function ValidationCard({ orderId }: { orderId: string }) {
  const db = useSubDb();
  const toast = useToast();
  const order = db.orders.find((o) => o.id === orderId)!;
  const [result, setResult] = useState<'sim' | 'nao' | ''>('');
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const v = order.validation!;
  const submit = () => {
    setTried(true);
    if (!result || (result === 'nao' && !comment.trim())) return;
    // O link pode ter sido encaminhado a um colega: a validação é sempre registrada em nome do solicitante original (RGN005)
    try {
      applyOrderValidation(order, result, comment, v.assignedTo);
      toast.show({ type: 'success', ...VALIDATION_TOAST[result] });
    } catch {
      toast.show({ type: 'error', title: 'Não foi possível registrar', message: 'Tente novamente em instantes.' });
    }
  };
  return (
    <DevNote note="Colaborador RF004-FLU004-FLU006 / RGN005 / CTA002: quando a OS entra em “Aguardando validação”, o solicitante responde Sim/Não (+ comentário; obrigatório se Não - 💡 a confirmar). Sim → OS e solicitação encerradas. Não → a OS volta para ação do responsável. Link encaminhado a um colega: registrado em nome do solicitante original. Sem nota de estrelas (RGN001).">
      <Card title="O serviço foi realizado" subtitle="Confirme se o problema foi resolvido">
        <Stack gap="md">
          <RadioButton
            name="resolved" label="O problema foi resolvido?" orientation="horizontal" value={result} onChange={(x) => setResult(x as 'sim' | 'nao')}
            options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} error={tried && !result ? requiredMessage('Resposta') : undefined}
          />
          <Textarea
            label="Comentário" optional={result !== 'nao'} required={result === 'nao'} rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            error={tried && result === 'nao' && !comment.trim() ? requiredMessage('Comentário') : undefined}
          />
          <div className="ext-actions"><Button onClick={submit}>Confirmar</Button></div>
        </Stack>
      </Card>
    </DevNote>
  );
}

mountApp(<AcompanharScreen />);
