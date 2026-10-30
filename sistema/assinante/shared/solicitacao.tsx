import { ReactNode, useEffect, useMemo, useState } from 'react';
import { PreviousServiceNotice, warrantyLine } from './warranty-ui';
import { warrantyOf } from './warranty';
import { IconCircleCheck, IconExternalLink, IconPhoto } from '@tabler/icons-react';
import { Badge, Button, Card, Dialog, Dropdown, Feedback, Stack, Tab, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { PRIORITY_MATRIX } from '../../admin/shared/data';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDate, formatDateTime, formatMoney, formatPhone, noBreak, requiredMessage } from '../../admin/shared/format';
import { IMPACT_LABEL, PROFILE_LABEL, Request, hoursAgo } from './data';
import { photoSrc } from './photos';
import { executorName, realizedCents } from './equipamento-lib';
import './solicitacao.css';
import { ShareButton } from './share-button';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { environmentName, equipmentOf, getSubDb, unitIdOfEquipment, unitName, userName, useSubSession } from './store';
import { DetailsReadOnly, detailsFilled, hasSafetyRisk } from './solicitacao-details';
import { CellPair, Col, Grid, ReadField, goTo, param, takeFlash, useRefs, TroubleshootingNotes } from './ui';
import {
  ComplementDialog, ConcludeDialog, GROUPS, IS_THUMB, RejectDialog, STS, changeRequest, canConclude, isOpenBase, suggestedPriority,
} from './solicitacoes-shared';

/** Estados: idle · reject · complement · close (abrem o diálogo) · required (campos obrigatórios) · answered (simula a resposta do solicitante - CTA004) */
const STATES = ['idle', 'reject', 'complement', 'close', 'required', 'answered', 'prioritychange'] as const;
type Mode = (typeof STATES)[number];
type Dlg = 'reject' | 'complement' | 'close' | null;

/** Simula a resposta do solicitante à complementação (PWA RF004): a solicitação volta a Em triagem. */
function withAnswer(r: Request): Request {
  const c = r.complement ?? { question: 'Pode enviar uma foto do painel de controle?', askedAt: hoursAgo(20) };
  return {
    ...r, statusId: STS.TRIAGE, statusChangedAt: hoursAgo(1),
    complement: { ...c, answer: 'Segue a foto do painel: o indicador de temperatura fica piscando logo depois de ligar.', answerPhoto: 'placa.webp', answeredAt: hoursAgo(1) },
    log: [...r.log, { id: 'demo-answer', at: hoursAgo(1), by: r.requesterName, text: 'Respondeu à complementação' }],
  };
}

type OtherRow = Record<string, unknown> & { id: string; r: Request };

/** Impacto sem tom automático de crítico: baixo = neutro, médio = informação, alto = atenção. */
const IMPACT_BADGE = { baixo: 'neutral', medio: 'info', alto: 'warning' } as const;
/** Protótipo: o cadastro guarda só a quantidade de fotos; estas imagens de demonstração fazem as miniaturas serem visualizáveis. */
/** Separa o evento do conteúdo registrado pelo usuário (motivo, mensagem): título em uma linha, conteúdo em outra com o rótulo adequado. */
function splitEvent(text: string): { title: string; detail?: string; label?: string } {
  const m = text.match(/^(Recusou a solicitação|Recusou como duplicada de S+?|Rejeitou[^:]*|Concluiu sem OS)(?:: (.+))?$/);
  if (m) return { title: m[1], detail: m[2], label: 'Motivo' };
  const c = text.match(/^(Solicitou complementação)(?:: (.+))?$/);
  if (c) return { title: c[1], detail: c[2], label: 'Mensagem' };
  return { title: text };
}
const DEMO_PHOTOS = ['forno2.webp', 'chapa.jpg', 'images.jpg', 'placa.webp'];

function SolicitacaoScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const refs = useRefs();
  const { db, user, can, unitIds, canSeeCosts } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const stored = db.requests.find((r) => r.id === param('id'));
  const allowed = !!stored && unitIds.includes(unitIdOfEquipment(db, stored.equipmentId));
  const req = useMemo(() => (stored && allowed ? (mode === 'answered' ? withAnswer(stored) : stored) : undefined), [stored, allowed, mode]);

  const [maintTypeId, setMaintTypeId] = useState(req?.maintTypeId ?? '');
  const [priorityId, setPriorityId] = useState(req?.priorityId ?? (stored ? suggestedPriority(db, stored, PRIORITY_MATRIX) : ''));
  const [priorityReason, setPriorityReason] = useState(req?.priorityChange?.reason ?? '');
  const [group, setGroup] = useState(req?.group ?? '');
  const [responsibleId, setResponsibleId] = useState(req?.responsibleId ?? '');
  const [notes, setNotes] = useState(req?.internalNotes ?? '');
  const [tried, setTried] = useState(false);
  const [dialog, setDialog] = useState<Dlg>(null);
  const [zoom, setZoom] = useState<{ name: string; title: string; label: string } | null>(null);
  const [histShown, setHistShown] = useState(8);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // RF402: ao abrir uma Nova pelo gestor, passa a Em triagem (com registro no histórico)
  useEffect(() => {
    if (!stored || !allowed || IS_THUMB || !can('solicitacoes', 'triar')) return;
    const cur = getSubDb().requests.find((r) => r.id === stored.id);
    if (cur?.statusId === STS.NEW) changeRequest(cur.id, user.name, { statusId: STS.TRIAGE }, 'Iniciou a triagem');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'reject' || mode === 'complement' || mode === 'close') setDialog(mode);
    if (mode === 'prioritychange' && stored) {
      // Variante: prioridade diferente da sugerida, com o motivo ainda em branco
      const sug = suggestedPriority(db, stored, PRIORITY_MATRIX);
      const other = refs.admin.priorities.find((p) => p.id !== sug);
      if (other) setPriorityId(other.id);
      setTried(true);
    }
    if (mode === 'required') { setMaintTypeId(''); setPriorityId(''); setGroup(''); setResponsibleId(''); setTried(true); }
  }, [mode]);

  if (!req) {
    return (
      <AppLayout active="solicitacoes" screen="solicitacoes">
        <Feedback type="error" title="Solicitação não encontrada" message="Ela não existe ou não pertence às suas unidades. Volte para a listagem e tente novamente" />
      </AppLayout>
    );
  }

  const eq = equipmentOf(db, req.equipmentId)!;
  const base = refs.base(req.statusId);
  const canTriage = can('solicitacoes', 'triar');
  // Aprovada já é uma decisão tomada: a classificação fica só leitura e o próximo passo é criar a OS (sem complementar, concluir ou rejeitar)
  const editable = canTriage && [STS.NEW, STS.TRIAGE, STS.WAITING].includes(req.statusId as never);
  const problem = refs.requestType(req.problemId)?.name ?? '-';
  const suggestion = suggestedPriority(db, req, PRIORITY_MATRIX);
  const criticality = refs.criticality(eq.criticalityId);
  const others = db.requests.filter((r) => r.equipmentId === req.equipmentId && r.id !== req.id && isOpenBase(refs.base(r.statusId)));
  // O histórico sempre registra o desfecho: OS vinculada, motivo da recusa e motivo da conclusão sem OS (acrescenta, se faltar no registro)
  const by = req.responsibleId ? userName(db, req.responsibleId) : 'Equipe de manutenção';
  const outcome: typeof req.log = [];
  if (req.osId && !req.log.some((l) => l.text.includes(req.osId!))) outcome.push({ id: 'out-os', at: req.statusChangedAt, by, text: `Convertida em ${req.osId}` });
  if (req.statusId === STS.REJECTED && req.closeReason && !req.log.some((l) => /^Recusou/.test(l.text))) {
    outcome.push({ id: 'out-rej', at: req.statusChangedAt, by, text: `${req.duplicateOf ? `Recusou como duplicada de ${req.duplicateOf}` : 'Recusou a solicitação'}: ${req.closeReason}` });
  }
  if (req.statusId === STS.DONE && req.closeReason && !req.log.some((l) => /^Concluiu/.test(l.text))) outcome.push({ id: 'out-done', at: req.statusChangedAt, by, text: `Concluiu sem OS: ${req.closeReason}` });
  const log = [...req.log, ...outcome].reverse().sort((a, b) => b.at.localeCompare(a.at));

  const typeOptions = refs.admin.maintenanceTypes.filter((t) => t.status === 'ativo' && t.id !== 'TMA-003').map((t) => ({ value: t.id, label: t.name }));
  const priorityOptions = refs.admin.priorities.map((p) => ({ value: p.id, label: p.name }));
  const unitId = unitIdOfEquipment(db, req.equipmentId);
  const staff = db.users.filter((u) => (u.status === 'ativo' && u.profile !== 'solicitante' && u.unitIds.includes(unitId)) || u.id === responsibleId);

  // Prioridade diferente da sugerida pela matriz: exige motivo, que vai para o histórico junto com a sugerida e a aplicada
  const priorityChanged = !!priorityId && !!suggestion && priorityId !== suggestion;
  const problems = {
    type: !maintTypeId ? requiredMessage('Tipo de manutenção') : undefined,
    priority: !priorityId ? requiredMessage('Prioridade') : undefined,
    priorityReason: priorityChanged && !priorityReason.trim() ? requiredMessage('Motivo da alteração da prioridade') : undefined,
    group: !group ? requiredMessage('Grupo responsável') : undefined,
    responsible: !responsibleId ? requiredMessage('Responsável') : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const extra: Partial<Request> = {
    maintTypeId: maintTypeId || undefined, priorityId: priorityId || undefined, group: group || undefined,
    responsibleId: responsibleId || undefined, internalNotes: notes.trim() || undefined,
    priorityChange: priorityChanged ? { suggestedId: suggestion, reason: priorityReason.trim() } : undefined,
  };

  // Aprovada e ainda sem OS: a aprovação está registrada e falta criar a OS (o botão principal passa a ser Criar OS, sem registrar outra aprovação)
  const approvedPending = req.statusId === STS.APPROVED && !req.osId;
  const approve = () => {
    setTried(true);
    if (invalid) {
      window.setTimeout(() => { const f = document.querySelector<HTMLElement>('main [aria-invalid="true"]'); f?.scrollIntoView({ block: 'center' }); f?.focus({ preventScroll: true }); }, 0);
      return;
    }
    changeRequest(req.id, user.name, { ...extra, statusId: STS.APPROVED }, [
      ...(priorityChanged ? [`Alterou a prioridade: sugerida ${refs.priority(suggestion)?.name ?? suggestion}, aplicada ${refs.priority(priorityId)?.name ?? priorityId}. Motivo: ${priorityReason.trim()}`] : []),
      'Aprovou a solicitação para criar OS',
    ]);
    goTo(`os-form.html?request=${req.id}`);
  };

  const otherCols: TableColumn<OtherRow>[] = [
    { key: 'id', label: 'Protocolo', render: (_, row) => <a className="text-link" href={`solicitacao.html?id=${row.r.id}`}>{noBreak(row.r.id)}</a> },
    { key: 'type', label: 'Tipo de solicitação / Descrição', render: (_, row) => <CellPair primary={refs.requestType(row.r.problemId)?.name ?? '-'} secondary={row.r.description.length > 48 ? `${row.r.description.slice(0, 48)}…` : row.r.description} /> },
    { key: 'r', label: 'Aberta em', render: (_, row) => noBreak(formatDateTime(row.r.openedAt)) },
    { key: 'status', label: 'Status', render: (_, row) => refs.statusBadge(row.r.statusId) },
  ];
  const otherRows: OtherRow[] = others.map((r) => ({ id: r.id, r }));
  const otherNote = 'RF402-FLU003 / RGN006: outras solicitações abertas do mesmo equipamento, para identificar possíveis duplicadas. Se for duplicada, rejeite como “Duplicada” informando o protocolo original.';

  const headerActions = (
    <>
      {req.osId && <Button onClick={() => goTo(`os.html?id=${req.osId}`)}>Ver OS {req.osId}</Button>}
      {approvedPending && canTriage && <Button onClick={() => goTo(`os-form.html?request=${req.id}`)}>Criar OS</Button>}
      {req.duplicateOf && <Button variant="secondary" onClick={() => goTo(`solicitacao.html?id=${req.duplicateOf}`)}>Ver protocolo original</Button>}
    </>
  );

  // Histórico do equipamento (desde a aquisição): OS, preventivas concluídas, outras solicitações, cadastro e aquisição
  type HistEvent = { id: string; at: string; kind: 'corretiva' | 'preventiva' | 'solicitacao' | 'marco'; title: ReactNode; meta: string; badge?: ReactNode };
  const eqHistory: HistEvent[] = [
    ...(eq.acquiredAt ? [{ id: 'acq', at: `${eq.acquiredAt.slice(0, 10)}T00:00:00`, kind: 'marco' as const, title: 'Equipamento adquirido', meta: canSeeCosts && eq.valueCents ? `Valor de aquisição: ${formatMoney(eq.valueCents)}` : '' }] : []),
    { id: 'reg', at: eq.createdAt, kind: 'marco' as const, title: 'Cadastrado no sistema', meta: '' },
    ...db.orders.filter((o) => o.equipmentId === eq.id).map((o): HistEvent => ({
      id: o.id, at: refs.base(o.statusId) === 'concluido' ? (o.activities[o.activities.length - 1]?.at ?? o.createdAt) : o.createdAt, kind: o.kind,
      title: <a className="text-link" href={`os.html?id=${o.id}`}>{o.subject}</a>,
      meta: [o.id, `Prestador: ${executorName(db, o.executor)}`, canSeeCosts && realizedCents(refs, o) > 0 ? `Custo: ${formatMoney(realizedCents(refs, o))}` : ''].filter(Boolean).join(' · '),
      badge: refs.statusBadge(o.statusId),
    })),
    ...db.executions.filter((x) => x.equipmentId === eq.id && x.status === 'concluida' && !x.osId).map((x): HistEvent => ({
      id: x.id, at: x.doneAt ?? `${x.dueDate}T09:00:00`, kind: 'preventiva',
      title: <a className="text-link" href={`plano.html?id=${x.planId}`}>{db.plans.find((p) => p.id === x.planId)?.name ?? 'Preventiva'}</a>,
      meta: `Executada por ${x.doneBy ?? '-'}`,
    })),
    ...others.concat(db.requests.filter((r) => r.equipmentId === eq.id && r.id !== req.id && !isOpenBase(refs.base(r.statusId)))).map((r): HistEvent => ({
      id: r.id, at: r.openedAt, kind: 'solicitacao',
      title: <a className="text-link" href={`solicitacao.html?id=${r.id}`}>{refs.requestType(r.problemId)?.name ?? 'Solicitação'}</a>,
      meta: [`${r.id} · aberta por ${r.requesterName}`, r.closeReason ? `Motivo: ${r.closeReason}` : ''].filter(Boolean).join(' · '), badge: refs.statusBadge(r.statusId),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const KIND_LABEL = { corretiva: 'Corretiva', preventiva: 'Preventiva', solicitacao: 'Solicitação', marco: '' } as const;
  const KIND_BADGE = { corretiva: 'warning', preventiva: 'info', solicitacao: 'neutral' } as const;

  const env = environmentName(db, eq.environmentId);
  const photoNames = Array.from({ length: req.photos }, (_, k) => DEMO_PHOTOS[k % DEMO_PHOTOS.length]);
  const photos = photoNames.length > 0 ? (
    <ul className="sol-photos" aria-label="Fotos enviadas pelo solicitante">
      {photoNames.map((n, k) => (
        <li key={k}>
          <button type="button" className="sol-photo" onClick={() => setZoom({ name: n, title: 'Foto da solicitação', label: `Foto ${k + 1} de ${photoNames.length}` })} aria-label={`Ampliar foto ${k + 1} de ${photoNames.length}`}>
            {photoSrc(n) ? <img src={photoSrc(n)} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  ) : 'Nenhuma';

  return (
    <AppLayout active="solicitacoes" screen="solicitacoes">
      <Stack gap="xl">
        <PageHeader
          title={req.id}
          badge={refs.statusBadge(req.statusId)}
          subtitle={`${problem} · ${eq.name}`}
          breadcrumb={[{ label: 'Solicitações', href: 'solicitacoes.html' }, { label: req.id }]}
          actions={req.osId || req.duplicateOf || (approvedPending && canTriage) ? headerActions : undefined}
          iconActions={<ShareButton kind="solicitacao" id={req.id} requiresLogin />}
        />

        {req.osId && (
          <Feedback type="info" title={`Convertida em ${req.osId}`} message="A partir daqui, o status da solicitação segue o da ordem de serviço. A tela fica somente em leitura" />
        )}
        {req.statusId === STS.WAITING && (
          <Feedback type="warning" title="Aguardando informação do solicitante" message={req.complement?.question ?? 'Um pedido de complementação foi enviado'} />
        )}
        {req.statusId === STS.TRIAGE && req.complement?.answer && (
          <Feedback type="info" title="O solicitante respondeu à complementação" message="A solicitação voltou para Em triagem. Veja a resposta nos dados da solicitação" />
        )}
        {req.statusId === STS.REJECTED && (
          <Feedback type="warning" title={req.duplicateOf ? `Recusada como duplicada de ${req.duplicateOf}` : 'Solicitação recusada'} message={req.closeReason ?? 'Sem motivo registrado'} />
        )}
        {req.statusId === STS.DONE && (
          <Feedback
            type="success"
            title={req.troubleshooting.overall === 'resolvido' ? 'Concluída sem OS: resolvida no troubleshooting' : 'Concluída sem OS'}
            message={req.closeReason ?? 'Sem observação registrada'}
          />
        )}
        {!canTriage && base !== undefined && (
          <Feedback type="info" title="Acompanhamento" message="Você pode acompanhar esta solicitação. A triagem é feita pelos gestores de manutenção" />
        )}

        <DevNote note="Arquitetura da triagem (RF402): à esquerda o contexto e as evidências (resumo, dados, notas do troubleshooting, equipamento associado, outras solicitações abertas do equipamento e histórico); à direita só a ação (classificação e encaminhamento, com as quatro decisões), que acompanha a rolagem no desktop. No mobile os blocos se empilham na ordem: contexto, decisão e histórico.">
          <div className="sol-layout">
            <div className="sol-left">
              <section className="sol-summary" aria-labelledby="sol-summary-t">
                <h2 id="sol-summary-t" className="sol-summary-title">{problem}</h2>
                <p className="sol-summary-text">{req.description}</p>
                <dl className="sol-meta">
                  <div><dt>Impacto</dt><dd><Badge status={IMPACT_BADGE[req.impact]} dot>{IMPACT_LABEL[req.impact]}</Badge></dd></div>
                  <div><dt>Equipamento</dt><dd>{eq.name}</dd></div>
                  <div><dt>Unidade</dt><dd>{unitName(db, unitId)}</dd></div>
                  <div><dt>Ambiente</dt><dd>{env ?? '-'}</dd></div>
                </dl>
              </section>

              <DevNote note="RF402: dados enviados pelo solicitante, o que inclui as fotos (miniaturas ampliáveis; o protótipo usa imagens de demonstração) e a relação com reparo anterior. Tipo de solicitação, descrição e impacto já estão no resumo da ocorrência (acima) e não se repetem aqui.">
                <Card className="card-open" title="Dados da solicitação" subtitle="Informações enviadas pelo solicitante">
                  <div className="card-body-tight">
                    <Grid>
                      <Col span={6}><ReadField label="Protocolo" value={req.id} /></Col>
                      <Col span={6}><ReadField label="Data e hora" value={formatDateTime(req.openedAt)} /></Col>
                      <Col span={6}><ReadField label="Solicitante" value={req.requesterName} /></Col>
                      <Col span={6}><ReadField label="Contato para retorno" value={noBreak(formatPhone(req.requesterPhone))} /></Col>
                      <Col span={6}><ReadField label="Canal de abertura" value={req.channel === 'QR' ? 'QR Code' : 'Portal'} /></Col>
                      <Col span={6}><ReadField label="Relacionado a reparo anterior" value={req.previousRepair.related ? 'Sim' : 'Não'} /></Col>
                      {req.previousRepair.related && <Col span={12}><ReadField label="Observação do reparo anterior" value={req.previousRepair.note} /></Col>}
                      {req.previousRepair.related && (
                        <Col span={12}>
                          <DevNote note="Dica de apoio quando o solicitante marca “Relacionado a reparo anterior”: o último serviço concluído no equipamento, quem executou, há quantos dias e se está dentro da garantia de serviço informada no cadastro do prestador. Só informa: decidir se é o MESMO problema do serviço anterior continua sendo de quem lê a solicitação (essa checagem de escopo não é automática). Em desenvolvimento a busca usa o histórico real de OS do equipamento.">
                            <PreviousServiceNotice db={db} equipmentId={req.equipmentId} />
                          </DevNote>
                        </Col>
                      )}
                      <Col span={12}><ReadField label="Fotos" value={photos} /></Col>
                    </Grid>
                  </div>
                </Card>
              </DevNote>

              {req.details && detailsFilled(req.details) && (
                <DevNote note="Detalhes adicionais (opcional): o que o solicitante informou além do essencial, só se preencheu algo (Ocorrência, O que já foi tentado, Impacto na operação, Segurança, Acesso e atendimento e Informações adicionais). É contexto para a triagem: não muda a prioridade sozinho (a prioridade segue a matriz criticidade × impacto). Risco de segurança de gás, fumaça ou elétrico informado pelo solicitante aparece em destaque no topo do card. 💡 A confirmar com o cliente se esse risco deve elevar o impacto ou avisar o gestor automaticamente.">
                  <Card className="card-open" title="Detalhes adicionais" subtitle="Informações extras enviadas pelo solicitante">
                    <div className="card-body-tight">
                      <Stack gap="md">
                        {hasSafetyRisk(req.details) && (
                          <Feedback type="warning" title="Risco de segurança informado" message="O solicitante indicou risco de gás, fumaça ou elétrico. Considere priorizar a triagem" />
                        )}
                        <DetailsReadOnly details={req.details} />
                      </Stack>
                    </div>
                  </Card>
                </DevNote>
              )}

              {req.complement && (
                <DevNote note="RF402-FLU006 e CTA004: a resposta do solicitante à complementação (PWA RF004) aparece aqui na triagem e a solicitação volta para Em triagem. Use o estado “Resposta recebida” do Navegador para simulá-la.">
                  <Card className="card-open" title="Complementação" subtitle="Pedido enviado ao solicitante e a resposta recebida">
                    <div className="card-body-tight">
                      <Grid>
                        <Col span={12}><ReadField label={`Pedido de ${formatDateTime(req.complement.askedAt)}`} value={req.complement.question} /></Col>
                        <Col span={12}><ReadField label={req.complement.answeredAt ? `Resposta de ${formatDateTime(req.complement.answeredAt)}` : 'Resposta'} value={req.complement.answer ?? (req.complement.answerPhoto ? undefined : 'Ainda não respondida')} /></Col>
                        {req.complement.answerPhoto && (
                          <Col span={12}>
                            <ReadField
                              label="Foto enviada na resposta"
                              value={(
                                <ul className="sol-photos" aria-label="Foto enviada pelo solicitante na resposta">
                                  <li>
                                    <button type="button" className="sol-photo" onClick={() => setZoom({ name: req.complement!.answerPhoto!, title: 'Foto da resposta', label: 'Enviada pelo solicitante' })} aria-label="Ampliar foto enviada na resposta">
                                      {photoSrc(req.complement.answerPhoto) ? <img src={photoSrc(req.complement.answerPhoto)} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
                                    </button>
                                  </li>
                                </ul>
                              )}
                            />
                          </Col>
                        )}
                      </Grid>
                    </div>
                  </Card>
                </DevNote>
              )}

              <DevNote note="RF402-RGN001 e RGN008 / RF403-CTA003: o troubleshooting acontece na abertura; a triagem só visualiza o resultado geral e cada dica (Realizada / Pulada), sem edição. As mesmas notas seguem para a OS e ficam visíveis ao técnico/prestador.">
                <TroubleshootingNotes run={req.troubleshooting} collapsible />
              </DevNote>

              <Card
                className="card-open" title="Equipamento associado" subtitle="Resumo do ativo"
                actions={<a className="text-link sol-asset-link" href={`equipamento.html?id=${eq.id}`}>Ver ativo <IconExternalLink size={16} aria-hidden="true" /></a>}
              >
                <div className="card-body-tight">
                  <div className="sol-eq">
                    <ReadField label="Equipamento" value={`${eq.name} · ${eq.code}`} />
                    <ReadField label="Status" value={refs.statusBadge(eq.statusId)} />
                    <ReadField label="Unidade" value={unitName(db, unitId)} />
                    <ReadField label="Ambiente" value={env} />
                    <div className="sol-eq-wide"><ReadField label="Garantia" value={<span className={warrantyOf(eq.warranty).kind === 'expiring' ? `warranty-expiring${warrantyOf(eq.warranty).urgent ? ' is-urgent' : ''}` : undefined}>{warrantyLine(eq.warranty)}</span>} /></div>
                  </div>
                </div>
              </Card>

              <DevNote note={otherNote}>
                {otherRows.length === 0 ? (
                  <Card className="card-open" title="Outras solicitações abertas do equipamento" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação">
                    <p className="sol-empty"><IconCircleCheck size={20} aria-hidden="true" />Nenhuma outra solicitação aberta</p>
                  </Card>
                ) : isMobile ? (
                  <MobileCardList
                    headingId="others-title" title="Outras solicitações abertas do equipamento" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" emptyTitle="Nenhuma outra solicitação aberta"
                    page={1} pageSize={Math.max(1, otherRows.length)} total={otherRows.length} onPageChange={() => undefined}
                    items={others.map((r) => ({ id: r.id, title: <a className="text-link" href={`solicitacao.html?id=${r.id}`}>{r.id}</a>, subtitle: refs.requestType(r.problemId)?.name ?? '-', badge: refs.statusBadge(r.statusId), fields: [{ label: 'Descrição', value: r.description.length > 48 ? `${r.description.slice(0, 48)}…` : r.description }, { label: 'Aberta em', value: formatDateTime(r.openedAt) }] }))}
                  />
                ) : (
                  <Table<OtherRow> title="Outras solicitações abertas do equipamento" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" columns={otherCols} rows={otherRows} empty={{ title: 'Nenhuma outra solicitação aberta' }} />
                )}
              </DevNote>

              <div className="sol-hist">
                <DevNote note="Histórico: a aba “Do equipamento” reúne tudo o que aconteceu com o ativo desde a aquisição (OS corretivas e preventivas, preventivas concluídas, outras solicitações, cadastro), para saber se houve reparos anteriores. A aba “Desta solicitação” traz as ações desta solicitação com autor e data (RF402-FLU007): abertura, triagem, complementação, decisões e criação de OS, da mais recente para a mais antiga.">
                  <Card className="card-open" title="Histórico" subtitle="O que já foi feito neste equipamento e nesta solicitação">
                    <div className="card-body-tight">
                      <Tab
                        aria-label="Histórico"
                        tabs={[
                          {
                            label: `Do equipamento (${eqHistory.length})`,
                            content: (
                              <Stack gap="md">
                                <ol className="sol-timeline">
                                  {eqHistory.slice(0, histShown).map((h) => (
                                    <li key={h.id} className={`sol-timeline-item is-${h.kind}`}>
                                      <span className="sol-timeline-head">
                                        <span className="sol-timeline-date">{formatDate(h.at.slice(0, 10))}</span>
                                        {KIND_LABEL[h.kind] && <Badge status={KIND_BADGE[h.kind as 'corretiva']} dot>{KIND_LABEL[h.kind]}</Badge>}
                                        {h.badge}
                                      </span>
                                      <span className="sol-timeline-text">{h.title}</span>
                                      {h.meta && <span className="sol-timeline-meta">{h.meta}</span>}
                                    </li>
                                  ))}
                                </ol>
                                {eqHistory.length > histShown && (
                                  <Stack direction="horizontal" justify="start"><Button variant="secondary" size="sm" onClick={() => setHistShown((n) => n + 8)}>Mostrar mais</Button></Stack>
                                )}
                              </Stack>
                            ),
                          },
                          {
                            label: `Desta solicitação (${log.length})`,
                            content: (
                              <ol className="sol-timeline">
                                {log.map((l) => {
                                  const ev = splitEvent(l.text);
                                  return (
                                    <li key={l.id} className="sol-timeline-item">
                                      <span className="sol-timeline-text">{ev.title}</span>
                                      {ev.detail && <span className="sol-timeline-detail"><span className="sol-timeline-detail-label">{ev.label}:</span> {ev.detail}</span>}
                                      <span className="sol-timeline-meta">{l.by} · {formatDateTime(l.at)}</span>
                                    </li>
                                  );
                                })}
                              </ol>
                            ),
                          },
                        ]}
                      />
                    </div>
                  </Card>
                </DevNote>
              </div>
            </div>

            <aside className="sol-right" aria-label="Triagem e decisão">
              {canTriage && (
                <DevNote note="RF402-FLU004 / FLU005 / CTA001: tipo de manutenção, prioridade, grupo responsável e responsável são obrigatórios para criar a OS (grupo: 💡 P05 a confirmar, não há cadastro de grupos previsto no contrato). Tipos de manutenção ativos do Admin (RF404), exceto Preventiva, atribuída pelos planos. Observações internas não são visíveis ao solicitante. As quatro decisões ficam no rodapé deste card: Aprovar e criar OS (principal; valida os campos, grava a classificação, passa a Aprovada e abre RF502 pré-preenchida), Solicitar complementação, Concluir sem OS e Rejeitar (cada uma pede o texto em modal e fica no histórico, CTA002). Fluxo de emergência sem triagem: FE004, fora do escopo.">
                  <Card
                    className="card-open" title="Classificação e encaminhamento"
                    subtitle={editable ? 'Classifique e escolha o encaminhamento' : approvedPending ? 'Classificação registrada na aprovação' : 'Classificação registrada na triagem'}
                    footer={editable ? (
                      <Stack gap="sm">
                        <p className="field-note">Aprovar registra a aprovação agora e abre a criação da OS. Se você sair sem criar a OS, a solicitação continua Aprovada e a OS pode ser criada depois</p>
                      <div className="sol-actions">
                        <Button onClick={approve}>Aprovar e criar OS</Button>
                        <Button variant="secondary" onClick={() => setDialog('complement')}>Solicitar complementação</Button>
                        {canConclude(req, base) && <Button variant="secondary" onClick={() => setDialog('close')}>Concluir sem OS</Button>}
                        <Button variant="ghost" className="sol-reject" onClick={() => setDialog('reject')}>Rejeitar</Button>
                      </div>
                      </Stack>
                    ) : approvedPending && canTriage ? (
                      <div className="sol-actions"><Button onClick={() => goTo(`os-form.html?request=${req.id}`)}>Criar OS</Button></div>
                    ) : undefined}
                  >
                    <div className="card-body-tight">
                      {editable ? (
                        <Stack gap="md">
                          <Dropdown label="Tipo de manutenção" required placeholder="Selecione" options={typeOptions} value={maintTypeId} onChange={setMaintTypeId} error={show('type')} />
                          <DevNote note={`💡 Prioridade sugerida pela matriz criticidade × impacto (Admin RF405): criticidade ${criticality?.name ?? '-'} e impacto ${IMPACT_LABEL[req.impact]} → ${refs.priority(suggestion)?.name ?? '-'}. O valor inicial é a sugestão, editável pelo gestor.`}>
                            <Dropdown
                              label="Prioridade" required placeholder="Selecione" options={priorityOptions} value={priorityId} onChange={setPriorityId} error={show('priority')}
                              helperText={suggestion ? `Sugestão: ${refs.priority(suggestion)?.name} (criticidade ${criticality?.name}, impacto ${IMPACT_LABEL[req.impact]})` : undefined}
                            />
                          </DevNote>
                          {priorityChanged && (
                            <DevNote note="Prioridade diferente da sugerida pela matriz (criticidade × impacto): o motivo da alteração é obrigatório e fica no histórico da solicitação, junto com a prioridade sugerida e a aplicada. O campo some se o gestor voltar à sugestão.">
                              <Textarea label="Motivo da alteração da prioridade" required rows={3} value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} error={show('priorityReason')} />
                            </DevNote>
                          )}
                          <Dropdown label="Grupo responsável" required placeholder="Selecione" options={GROUPS.map((g) => ({ value: g, label: g }))} value={group} onChange={setGroup} error={show('group')} />
                          <Dropdown
                            label="Responsável" required placeholder="Selecione" value={responsibleId} onChange={setResponsibleId} error={show('responsible')}
                            options={staff.map((u) => ({ value: u.id, label: `${u.name} · ${PROFILE_LABEL[u.profile]}` }))}
                          />
                          <Textarea label="Observações internas" optional rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} helperText="Não visíveis ao solicitante" />
                        </Stack>
                      ) : (
                        <Stack gap="md">
                          {approvedPending && (
                            <DevNote note="Estado Aprovada sem OS (existe de propósito: a aprovação e a criação da OS são passos separados, porque a OS pede executor, prazo e agenda). Aprovada é uma decisão tomada: a classificação aparece só para leitura e as outras decisões (complementar, concluir sem OS, rejeitar) saem; o próximo passo é Criar OS, que não registra uma segunda aprovação.">
                              <Feedback type="info" title="Aprovada, falta criar a OS" message="A aprovação já está registrada, mas a OS ainda não foi criada. Use Criar OS para continuar" />
                            </DevNote>
                          )}
                          <ReadField label="Tipo de manutenção" value={refs.maintType(req.maintTypeId)?.name} />
                          <ReadField label="Prioridade" value={req.priorityId ? refs.priorityBadge(req.priorityId) : undefined} />
                          {req.priorityChange && <ReadField label="Prioridade sugerida" value={refs.priorityBadge(req.priorityChange.suggestedId)} />}
                          {req.priorityChange && <ReadField label="Motivo da alteração da prioridade" value={req.priorityChange.reason} />}
                          <ReadField label="Grupo responsável" value={req.group} />
                          <ReadField label="Responsável" value={req.responsibleId ? userName(db, req.responsibleId) : undefined} />
                          <ReadField label="Observações internas" value={req.internalNotes} />
                        </Stack>
                      )}
                    </div>
                  </Card>
                </DevNote>
              )}
            </aside>
          </div>
        </DevNote>
      </Stack>

      {zoom !== null && (
        <Dialog open onClose={() => setZoom(null)} size="md" title={zoom.title} subtitle={zoom.label}>
          <div className="sol-photo-zoom">{photoSrc(zoom.name) ? <img src={photoSrc(zoom.name)} alt={`${zoom.title}: ${zoom.label}`} /> : <IconPhoto size={64} aria-hidden="true" />}</div>
        </Dialog>
      )}
      {dialog === 'close' && <ConcludeDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
      {dialog === 'reject' && <RejectDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
      {dialog === 'complement' && <ComplementDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
    </AppLayout>
  );
}

mountApp(<SolicitacaoScreen />);
