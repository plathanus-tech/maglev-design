import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, Feedback, Stack, Table, TableColumn, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { PRIORITY_MATRIX } from '../../admin/shared/data';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { formatDateTime, formatPhone, noBreak, requiredMessage } from '../../admin/shared/format';
import { IMPACT_LABEL, PROFILE_LABEL, Request, hoursAgo } from './data';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { environmentName, equipmentOf, getSubDb, unitIdOfEquipment, unitName, userName, useSubSession } from './store';
import { CellPair, Col, Grid, ReadField, goTo, param, takeFlash, useRefs, TroubleshootingNotes } from './ui';
import {
  ComplementDialog, ConcludeDialog, GROUPS, IS_THUMB, RejectDialog, STS, changeRequest, canConclude, isOpenBase, suggestedPriority,
} from './solicitacoes-shared';

/** Estados: idle · reject · complement · close (abrem o diálogo) · required (campos obrigatórios) · answered (simula a resposta do solicitante - CTA004) */
const STATES = ['idle', 'reject', 'complement', 'close', 'required', 'answered'] as const;
type Mode = (typeof STATES)[number];
type Dlg = 'reject' | 'complement' | 'close' | null;

/** Simula a resposta do solicitante à complementação (PWA RF004): a solicitação volta a Em triagem. */
function withAnswer(r: Request): Request {
  const c = r.complement ?? { question: 'Pode enviar uma foto do painel de controle?', askedAt: hoursAgo(20) };
  return {
    ...r, statusId: STS.TRIAGE, statusChangedAt: hoursAgo(1),
    complement: { ...c, answer: 'Segue o vídeo: o ruído começa uns 10 minutos depois de ligar e a tampa lateral vibra junto.', answeredAt: hoursAgo(1) },
    log: [...r.log, { id: 'demo-answer', at: hoursAgo(1), by: r.requesterName, text: 'Respondeu à complementação' }],
  };
}

type OtherRow = Record<string, unknown> & { id: string; r: Request };

function SolicitacaoScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const refs = useRefs();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const stored = db.requests.find((r) => r.id === param('id'));
  const allowed = !!stored && unitIds.includes(unitIdOfEquipment(db, stored.equipmentId));
  const req = useMemo(() => (stored && allowed ? (mode === 'answered' ? withAnswer(stored) : stored) : undefined), [stored, allowed, mode]);

  const [maintTypeId, setMaintTypeId] = useState(req?.maintTypeId ?? '');
  const [priorityId, setPriorityId] = useState(req?.priorityId ?? (stored ? suggestedPriority(db, stored, PRIORITY_MATRIX) : ''));
  const [group, setGroup] = useState(req?.group ?? '');
  const [responsibleId, setResponsibleId] = useState(req?.responsibleId ?? '');
  const [notes, setNotes] = useState(req?.internalNotes ?? '');
  const [tried, setTried] = useState(false);
  const [dialog, setDialog] = useState<Dlg>(null);

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
  const editable = canTriage && [STS.NEW, STS.TRIAGE, STS.WAITING, STS.APPROVED].includes(req.statusId as never);
  const problem = refs.requestType(req.problemId)?.name ?? '-';
  const suggestion = suggestedPriority(db, req, PRIORITY_MATRIX);
  const criticality = refs.criticality(eq.criticalityId);
  const others = db.requests.filter((r) => r.equipmentId === req.equipmentId && r.id !== req.id && isOpenBase(refs.base(r.statusId)));
  const log = [...req.log].reverse().sort((a, b) => b.at.localeCompare(a.at));

  const typeOptions = refs.admin.maintenanceTypes.filter((t) => t.status === 'ativo' && t.id !== 'TMA-003').map((t) => ({ value: t.id, label: t.name }));
  const priorityOptions = refs.admin.priorities.map((p) => ({ value: p.id, label: p.name }));
  const unitId = unitIdOfEquipment(db, req.equipmentId);
  const staff = db.users.filter((u) => (u.status === 'ativo' && u.profile !== 'solicitante' && u.unitIds.includes(unitId)) || u.id === responsibleId);

  const problems = {
    type: !maintTypeId ? requiredMessage('Tipo de manutenção') : undefined,
    priority: !priorityId ? requiredMessage('Prioridade') : undefined,
    group: !group ? requiredMessage('Grupo responsável') : undefined,
    responsible: !responsibleId ? requiredMessage('Responsável') : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const extra: Partial<Request> = {
    maintTypeId: maintTypeId || undefined, priorityId: priorityId || undefined, group: group || undefined,
    responsibleId: responsibleId || undefined, internalNotes: notes.trim() || undefined,
  };

  const approve = () => {
    setTried(true);
    if (invalid) {
      window.setTimeout(() => { const f = document.querySelector<HTMLElement>('main [aria-invalid="true"]'); f?.scrollIntoView({ block: 'center' }); f?.focus({ preventScroll: true }); }, 0);
      return;
    }
    changeRequest(req.id, user.name, { ...extra, statusId: STS.APPROVED }, 'Aprovou a solicitação para criar OS');
    goTo(`os-form.html?request=${req.id}`);
  };

  const otherCols: TableColumn<OtherRow>[] = [
    { key: 'id', label: 'Protocolo', render: (_, row) => <a className="text-link" href={`solicitacao.html?id=${row.r.id}`}>{noBreak(row.r.id)}</a> },
    { key: 'r', label: 'Data', render: (_, row) => noBreak(formatDateTime(row.r.openedAt)) },
    { key: 'status', label: 'Status', render: (_, row) => refs.statusBadge(row.r.statusId) },
  ];
  const otherRows: OtherRow[] = others.map((r) => ({ id: r.id, r }));
  const otherNote = 'RF402-FLU003 / RGN006: outras solicitações abertas do mesmo equipamento, para identificar possíveis duplicadas. Se for duplicada, rejeite como “Duplicada” informando o protocolo original.';

  const headerActions = (
    <>
      {req.osId && <Button onClick={() => goTo(`os.html?id=${req.osId}`)}>Ver OS {req.osId}</Button>}
      {req.duplicateOf && <Button variant="secondary" onClick={() => goTo(`solicitacao.html?id=${req.duplicateOf}`)}>Ver protocolo original</Button>}
    </>
  );

  return (
    <AppLayout active="solicitacoes" screen="solicitacoes">
      <Stack gap="xl">
        <PageHeader
          title={req.id}
          badge={refs.statusBadge(req.statusId)}
          subtitle={`${problem} · ${eq.name}`}
          breadcrumb={[{ label: 'Solicitações', href: 'solicitacoes.html' }, { label: req.id }]}
          actions={req.osId || req.duplicateOf ? headerActions : undefined}
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

        <Grid>
          <Col span={8}>
            <Stack gap="xl">
              <Card className="card-open" title="Dados da solicitação" subtitle="Informações enviadas pelo solicitante">
                <div className="card-body-tight">
                  <Grid>
                    <Col span={6}><ReadField label="Protocolo" value={req.id} /></Col>
                    <Col span={6}><ReadField label="Data e hora" value={formatDateTime(req.openedAt)} /></Col>
                    <Col span={6}><ReadField label="Solicitante" value={req.requesterName} /></Col>
                    <Col span={6}><ReadField label="Contato para retorno" value={noBreak(formatPhone(req.requesterPhone))} /></Col>
                    <Col span={6}><ReadField label="Canal" value={req.channel === 'QR' ? 'QR Code' : 'Portal'} /></Col>
                    <Col span={6}><ReadField label="Tipo de problema" value={problem} /></Col>
                    <Col span={6}><ReadField label="Impacto" value={IMPACT_LABEL[req.impact]} /></Col>
                    <Col span={6}><ReadField label="Fotos" value={req.photos ? `${req.photos} ${req.photos === 1 ? 'foto' : 'fotos'}` : 'Nenhuma'} /></Col>
                    <Col span={12}><ReadField label="Descrição" value={req.description} /></Col>
                    <Col span={6}><ReadField label="Relacionado a reparo anterior" value={req.previousRepair.related ? 'Sim' : 'Não'} /></Col>
                    {req.previousRepair.related && <Col span={6}><ReadField label="Observação do reparo anterior" value={req.previousRepair.note} /></Col>}
                  </Grid>
                </div>
              </Card>

              <DevNote note="RF402-RGN001 e RGN008 / RF403-CTA003: o troubleshooting acontece na abertura; a triagem só visualiza o resultado geral e cada dica (Realizada / Pulada). As mesmas notas seguem para a OS e ficam visíveis ao técnico/prestador.">
                <TroubleshootingNotes run={req.troubleshooting} />
              </DevNote>

              {req.complement && (
                <DevNote note="RF402-FLU006 e CTA004: a resposta do solicitante à complementação (PWA RF004) aparece aqui na triagem e a solicitação volta para Em triagem. Use o estado “Resposta recebida” do Navegador para simulá-la.">
                  <Card className="card-open" title="Complementação" subtitle="Pedido enviado ao solicitante e a resposta recebida">
                    <div className="card-body-tight">
                      <Grid>
                        <Col span={12}><ReadField label={`Pedido de ${formatDateTime(req.complement.askedAt)}`} value={req.complement.question} /></Col>
                        <Col span={12}><ReadField label={req.complement.answeredAt ? `Resposta de ${formatDateTime(req.complement.answeredAt)}` : 'Resposta'} value={req.complement.answer ?? 'Ainda não respondida'} /></Col>
                      </Grid>
                    </div>
                  </Card>
                </DevNote>
              )}

              <DevNote note={otherNote}>
                {isMobile ? (
                  <MobileCardList
                    headingId="others-title" title="Outras solicitações abertas do equipamento" subtitle="Possíveis duplicadas" emptyTitle="Nenhuma outra solicitação aberta"
                    page={1} pageSize={Math.max(1, otherRows.length)} total={otherRows.length} onPageChange={() => undefined}
                    items={others.map((r) => ({ id: r.id, title: <a className="text-link" href={`solicitacao.html?id=${r.id}`}>{r.id}</a>, badge: refs.statusBadge(r.statusId), fields: [{ label: 'Data', value: formatDateTime(r.openedAt) }] }))}
                  />
                ) : (
                  <Table<OtherRow> title="Outras solicitações abertas do equipamento" subtitle="Possíveis duplicadas" columns={otherCols} rows={otherRows} empty={{ title: 'Nenhuma outra solicitação aberta' }} />
                )}
              </DevNote>

              {canTriage && (
                <DevNote note="RF402-FLU004 / CTA001: tipo de manutenção, prioridade, grupo responsável e responsável são obrigatórios para criar a OS. Tipos de manutenção ativos do Admin (RF404), exceto Preventiva, que é atribuída automaticamente pelos planos. Grupo responsável: 💡 P05 a confirmar, não há cadastro de grupos previsto no contrato. Observações internas não são visíveis ao solicitante.">
                  <Card className="card-open" title="Classificação" subtitle={editable ? 'Classifique antes de decidir o encaminhamento' : 'Classificação registrada na triagem'}>
                    <div className="card-body-tight">
                      {editable ? (
                        <Grid>
                          <Col span={6}><Dropdown label="Tipo de manutenção" required placeholder="Selecione" options={typeOptions} value={maintTypeId} onChange={setMaintTypeId} error={show('type')} /></Col>
                          <Col span={6}>
                            <DevNote note={`💡 Prioridade sugerida pela matriz criticidade × impacto (Admin RF405): criticidade ${criticality?.name ?? '-'} e impacto ${IMPACT_LABEL[req.impact]} → ${refs.priority(suggestion)?.name ?? '-'}. O valor inicial é a sugestão, editável pelo gestor.`}>
                              <Dropdown
                                label="Prioridade" required placeholder="Selecione" options={priorityOptions} value={priorityId} onChange={setPriorityId} error={show('priority')}
                                helperText={suggestion ? `Sugestão: ${refs.priority(suggestion)?.name} (criticidade ${criticality?.name}, impacto ${IMPACT_LABEL[req.impact]})` : undefined}
                              />
                            </DevNote>
                          </Col>
                          <Col span={6}><Dropdown label="Grupo responsável" required placeholder="Selecione" options={GROUPS.map((g) => ({ value: g, label: g }))} value={group} onChange={setGroup} error={show('group')} /></Col>
                          <Col span={6}>
                            <Dropdown
                              label="Responsável" required placeholder="Selecione" value={responsibleId} onChange={setResponsibleId} error={show('responsible')}
                              options={staff.map((u) => ({ value: u.id, label: `${u.name} · ${PROFILE_LABEL[u.profile]}` }))}
                            />
                          </Col>
                          <Col span={12}><Textarea label="Observações internas" optional rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} helperText="Não visíveis ao solicitante" /></Col>
                        </Grid>
                      ) : (
                        <Grid>
                          <Col span={6}><ReadField label="Tipo de manutenção" value={refs.maintType(req.maintTypeId)?.name} /></Col>
                          <Col span={6}><ReadField label="Prioridade" value={req.priorityId ? refs.priorityBadge(req.priorityId) : undefined} /></Col>
                          <Col span={6}><ReadField label="Grupo responsável" value={req.group} /></Col>
                          <Col span={6}><ReadField label="Responsável" value={req.responsibleId ? userName(db, req.responsibleId) : undefined} /></Col>
                          <Col span={12}><ReadField label="Observações internas" value={req.internalNotes} /></Col>
                        </Grid>
                      )}
                    </div>
                  </Card>
                </DevNote>
              )}

              {editable && (
                <DevNote note="RF402-FLU005: Aprovar e criar OS valida tipo, prioridade, grupo e responsável (CTA001), grava a classificação, passa a Aprovada e abre RF502 com os dados pré-preenchidos. Solicitar complementação, Concluir sem OS e Rejeitar exigem texto e ficam no histórico (CTA002). Fluxo de emergência sem triagem: FE004, fora do escopo.">
                  <Card className="card-open" title="Decisão" subtitle="Escolha o encaminhamento da solicitação">
                    <div className="card-body-tight">
                      <Stack direction="horizontal" gap="sm" wrap>
                        <Button onClick={approve}>Aprovar e criar OS</Button>
                        <Button variant="secondary" onClick={() => setDialog('complement')}>Solicitar complementação</Button>
                        {canConclude(req, base) && <Button variant="secondary" onClick={() => setDialog('close')}>Concluir sem OS</Button>}
                        <Button variant="destructive" onClick={() => setDialog('reject')}>Rejeitar</Button>
                      </Stack>
                    </div>
                  </Card>
                </DevNote>
              )}
            </Stack>
          </Col>

          <Col span={4}>
            <Stack gap="xl">
              <Card className="card-open" title="Equipamento associado" subtitle="Resumo do ativo">
                <div className="card-body-tight">
                  <Stack gap="md">
                    <ReadField label="Equipamento" value={`${eq.name} · ${eq.code}`} />
                    <ReadField label="Status" value={refs.statusBadge(eq.statusId)} />
                    <ReadField label="Unidade" value={unitName(db, unitId)} />
                    <ReadField label="Ambiente" value={environmentName(db, eq.environmentId)} />
                    <a className="text-link" href={`equipamento.html?id=${eq.id}`}>Ver ativo</a>
                  </Stack>
                </div>
              </Card>

              <DevNote note="RF402-FLU007: todas as ações (abertura, triagem, complementação, decisões) ficam registradas com autor e data, da mais recente para a mais antiga.">
                <Card className="card-open" title="Histórico" subtitle="Todas as ações da solicitação">
                  <div className="card-body-tight">
                    <Stack as="ol" gap="md" className="ts-list">
                      {log.map((l) => (
                        <li key={l.id} className="ts-item">
                          <CellPair primary={l.text} secondary={`${l.by} · ${formatDateTime(l.at)}`} />
                        </li>
                      ))}
                    </Stack>
                  </div>
                </Card>
              </DevNote>
            </Stack>
          </Col>
        </Grid>
      </Stack>

      {dialog === 'close' && <ConcludeDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
      {dialog === 'reject' && <RejectDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
      {dialog === 'complement' && <ComplementDialog request={req} extra={extra} onClose={() => setDialog(null)} />}
    </AppLayout>
  );
}

mountApp(<SolicitacaoScreen />);
