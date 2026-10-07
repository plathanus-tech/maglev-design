import { useEffect, useMemo, useState } from 'react';
import { IconCamera, IconCheck, IconPaperclip, IconTrash } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, Feedback, Input, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, requiredMessage } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { CHECKLIST_KIND_LABEL, Execution, Request } from './data';
import { evidenceFile, executorOf } from './preventivas';
import { nextSeq, logEntry, notify, unitName, updateSubDb, useSubSession } from './store';
import { Col, Grid, ReadField, param, useRefs } from './ui';

/**
 * RF603 - Execução da preventiva pelo executor (interno ou prestador), pensada para o celular: tudo em coluna,
 * botões grandes. Estados: idle · incomplete (tentativa de concluir com pendências) · anomaly (com anomalia) · done (concluída, leitura).
 */
const STATES = ['idle', 'incomplete', 'anomaly', 'done'] as const;
type Mode = (typeof STATES)[number];

const READING = 'Leitura/medição';
const SIGNATURE = 'Assinatura/aceite';
const isUpload = (label: string, hasReadings: boolean) => !(label === SIGNATURE || (label === READING && hasReadings));
const attachLabel = (label: string) => (/relat/i.test(label) ? 'Anexar arquivo' : 'Anexar foto');

function ExecucaoScreen() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const refs = useRefs();
  const { db, user, can } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const order = db.orders.find((o) => o.id === param('os'));
  const plan = order?.planId ? db.plans.find((p) => p.id === order.planId) : undefined;
  const equipment = order ? db.equipments.find((e) => e.id === order.equipmentId) : undefined;

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [attached, setAttached] = useState<string[]>([]);
  const [anomaly, setAnomaly] = useState('');
  const [anomalyPhoto, setAnomalyPhoto] = useState(false);
  const [signName, setSignName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);

  const isDone = order?.statusId === 'STO-08' && !!order.execution;
  const cancelled = order?.statusId === 'STO-09';
  const demoDone = mode === 'done' && !isDone && !!plan;
  const readOnly = isDone || demoDone || cancelled || !can('os', 'editar');
  const hasReadings = !!plan?.checklist.some((c) => c.kind === 'leitura');

  // Variantes do navegador: preenchem um exemplo
  useEffect(() => {
    if (!plan || isDone) return;
    const mandatory = plan.checklist.filter((c) => c.kind !== 'opcional');
    const complete = () => {
      setChecks(Object.fromEntries(plan.checklist.filter((c) => c.kind !== 'leitura').map((c) => [c.id, true])));
      setReadings(Object.fromEntries(plan.checklist.filter((c) => c.kind === 'leitura').map((c) => [c.id, '3,5'])));
      setAttached(plan.evidences.filter((e) => isUpload(e, hasReadings)));
      setSignName(user.name); setAccepted(true);
    };
    if (mode === 'incomplete') { setChecks(mandatory[0] ? { [mandatory[0].id]: true } : {}); setTried(true); }
    if (mode === 'anomaly') { complete(); setAnomaly('Vedação da porta ressecada, com folga na parte inferior'); setAnomalyPhoto(true); }
    if (mode === 'done') { complete(); setNotes('Execução sem intercorrências'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, plan?.id]);

  // Valores exibidos: os salvos (concluída) ou os do formulário
  const saved: Execution | undefined = isDone ? order!.execution : undefined;
  const v = saved
    ? { checks: saved.checks, readings: saved.readings, attached: saved.evidences, anomaly: saved.anomaly ?? '', notes: saved.notes ?? '', signedBy: saved.signedBy ?? '', accepted: !!saved.signedBy }
    : { checks, readings, attached, anomaly, notes, signedBy: signName, accepted };

  const pending = useMemo(() => {
    if (!plan) return [] as string[];
    const out: string[] = [];
    plan.checklist.forEach((c) => {
      if (c.kind === 'obrigatorio' && !checks[c.id]) out.push(`Marcar o item: ${c.text}`);
      if (c.kind === 'leitura' && !(Number((readings[c.id] ?? '').replace(',', '.')) >= 0 && (readings[c.id] ?? '').trim())) out.push(`Registrar a leitura: ${c.text}`);
    });
    plan.evidences.forEach((e) => {
      if (isUpload(e, hasReadings) && !attached.includes(e)) out.push(`Anexar a evidência: ${e}`);
      if (e === SIGNATURE && !(signName.trim() && accepted)) out.push('Registrar a assinatura/aceite (nome e confirmação)');
    });
    return out;
  }, [plan, checks, readings, attached, signName, accepted, hasReadings]);

  if (!order || !plan || order.kind !== 'preventiva' || !equipment) {
    return (
      <AppLayout active="os" screen="os">
        <Feedback type="error" title="OS preventiva não encontrada" message="Abra a execução a partir de uma OS preventiva em Ordens de serviço" />
      </AppLayout>
    );
  }
  // Executor acessa só as suas OS
  if (user.profile === 'executor' && !(order.executor.kind === 'interno' && order.executor.userId === user.id)) {
    return (
      <AppLayout active="os" screen="os">
        <Feedback type="error" title="Sem acesso a esta OS" message="Você só acessa as ordens de serviço atribuídas a você" />
      </AppLayout>
    );
  }

  const executor = executorOf(db, order.executor);
  const hasAnomaly = !!v.anomaly.trim();
  const willOpenRequest = hasAnomaly && plan.onAnomaly === 'abrir-solicitacao';
  const attach = (label: string, on: boolean) => setAttached((a) => (on ? [...new Set([...a, label])] : a.filter((x) => x !== label)));

  const complete = () => {
    setTried(true);
    if (pending.length) { window.setTimeout(() => document.getElementById('pendencias')?.scrollIntoView({ block: 'center' }), 0); return; }
    const at = new Date().toISOString().slice(0, 19);
    const doneBy = order.executor.kind === 'interno' ? executor.primary : order.executor.technician ?? executor.primary;
    const execution: Execution = { checks, readings, evidences: attached, anomaly: anomaly.trim() || undefined, notes: notes.trim() || undefined, signedBy: signName.trim() || undefined };
    let newRequest: Request | undefined;
    updateSubDb((d) => {
      let requests = d.requests;
      if (willOpenRequest) {
        const id = nextSeq('SOL', d.requests.map((r) => r.id));
        newRequest = {
          id, equipmentId: equipment.id, problemId: 'TSO-008', impact: 'medio',
          description: `Anomalia encontrada na preventiva ${order.id} (${plan.name}): ${anomaly.trim()}`, photos: anomalyPhoto ? 1 : 0,
          requesterName: user.name, requesterPhone: user.phone, requesterUserId: user.id, channel: 'Portal', openedAt: at, statusId: 'STS-01', statusChangedAt: at,
          previousRepair: { related: false }, troubleshooting: { overall: 'nao-iniciado', tips: [] },
          log: [logEntry(user.name, `Abriu a solicitação automaticamente a partir da preventiva ${order.id}`)],
        };
        requests = [...d.requests, newRequest];
      }
      return {
        ...d, requests,
        orders: d.orders.map((o) => (o.id !== order.id ? o : {
          ...o, statusId: 'STO-08', execution,
          files: [...o.files, ...attached.map((a, i) => ({ id: `EX-${Date.now()}-${i}`, name: evidenceFile(a), kind: 'foto' as const, at, by: user.name }))],
          activities: [...o.activities, logEntry(user.name, `Concluiu a execução da preventiva${newRequest ? ` - anomalia registrada e solicitação ${newRequest.id} aberta` : ''}`)],
        })),
        executions: d.executions.map((x) => (x.id === order.executionId ? { ...x, status: 'concluida' as const, doneAt: at, doneBy, osId: order.id, anomalies: anomaly.trim() || undefined } : x)),
      };
    });
    const managers = db.users.filter((u) => (u.profile === 'administrador' || u.profile === 'gestor') && u.status === 'ativo').map((u) => u.id);
    notify([order.responsibleId, ...managers], { title: 'Preventiva concluída', text: `${order.id}: ${equipment.name} - ${plan.name}`, href: `os.html?id=${order.id}`, kind: 'preventiva' });
    if (newRequest) notify(managers, { title: 'Solicitação aberta por anomalia', text: `${newRequest.id}: ${equipment.name} - ${anomaly.trim()}`, href: `solicitacao.html?id=${newRequest.id}`, kind: 'solicitacao' });
    toast.show({ type: 'success', title: 'Execução concluída', message: newRequest ? `A solicitação corretiva ${newRequest.id} foi aberta para o equipamento.` : 'A OS foi concluída e o histórico do equipamento foi atualizado.' });
    setTried(false);
  };

  const block = isMobile ? 'btn-block' : undefined;
  const checkError = (id: string) => (tried && !readOnly && !checks[id] ? 'Marque este item para concluir' : undefined);

  return (
    <AppLayout active="os" screen="os">
      <form className="form-page" onSubmit={(e) => { e.preventDefault(); if (!readOnly) complete(); }} noValidate>
        <Stack gap="xl">
          <PageHeader
            title="Executar preventiva" subtitle={`${order.id} · ${plan.name}`} badge={refs.statusBadge(order.statusId)}
            breadcrumb={[{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: 'Executar preventiva' }]}
          />

          {(isDone || demoDone) && (
            <Feedback
              type="success" title="Execução concluída"
              message={`Concluída por ${executor.primary}. O histórico do equipamento e o cumprimento do plano foram atualizados${isDone ? '' : ' (exemplo de demonstração)'}`}
            />
          )}
          {cancelled && <Feedback type="warning" title="OS cancelada" message={order.cancelReason ?? 'Esta OS foi cancelada e não pode ser executada'} />}
          {!can('os', 'editar') && !isDone && !demoDone && <Feedback type="info" message="Seu perfil só visualiza esta execução" />}

          <Card className="card-open" title="Dados da OS" subtitle="Preventiva gerada automaticamente pelo plano">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><ReadField label="OS" value={<a className="text-link" href={`os.html?id=${order.id}`}>{order.id}</a>} /></Col>
                <Col span={6}><ReadField label="Plano" value={<a className="text-link" href={`plano.html?id=${plan.id}`}>{plan.name}</a>} /></Col>
                <Col span={6}><ReadField label="Equipamento" value={<a className="text-link" href={`equipamento.html?id=${equipment.id}`}>{equipment.name}</a>} /></Col>
                <Col span={6}><ReadField label="Unidade" value={unitName(db, equipment.unitId)} /></Col>
                <Col span={6}><ReadField label="Data prevista" value={formatDate(order.dueAt)} /></Col>
                <Col span={6}><ReadField label="Executor" value={executor.primary} /></Col>
              </Grid>
            </div>
          </Card>

          {!readOnly && pending.length > 0 && (
            <div id="pendencias" tabIndex={-1}>
              <DevNote note="RF603-RGN001 / CTA001: não é possível concluir sem os itens obrigatórios (checklist e leituras) e as evidências obrigatórias do plano. O botão fica ativo e, ao tentar concluir, as pendências são destacadas.">
                <Feedback
                  type={tried ? 'error' : 'warning'} title={`${pending.length} ${pending.length === 1 ? 'pendência' : 'pendências'} para concluir`}
                  message={pending.join(' · ')}
                />
              </DevNote>
            </div>
          )}

          <DevNote note="RF603-FLU002: cada item do checklist é marcado; itens “Leitura obrigatória” pedem valor + unidade de medida. Obrigatórios precisam ser marcados; opcionais, não.">
            <Card className="card-open" title="Checklist" subtitle="Marque cada procedimento e registre as leituras">
              <div className="card-body-tight">
                <Stack gap="lg">
                  {plan.checklist.map((c) => (
                    <Stack key={c.id} gap="xs">
                      {c.kind === 'leitura' ? (
                        <Input
                          label={c.text} required inputMode="decimal" disabled={readOnly} value={v.readings[c.id] ?? ''}
                          onChange={(e) => setReadings((r) => ({ ...r, [c.id]: e.target.value.replace(/[^\d.,-]/g, '') }))}
                          iconRight={<span className="cell-secondary">{c.unit}</span>}
                          error={tried && !readOnly && !(v.readings[c.id] ?? '').trim() ? requiredMessage('Leitura') : undefined}
                        />
                      ) : (
                        <Checkbox label={c.text} checked={!!v.checks[c.id]} disabled={readOnly} onChange={(e) => setChecks((x) => ({ ...x, [c.id]: e.target.checked }))} error={c.kind === 'obrigatorio' ? checkError(c.id) : undefined} />
                      )}
                      <Stack direction="horizontal" gap="xs"><Badge status={c.kind === 'opcional' ? 'neutral' : c.kind === 'leitura' ? 'info' : 'brand'}>{CHECKLIST_KIND_LABEL[c.kind]}</Badge></Stack>
                    </Stack>
                  ))}
                </Stack>
              </div>
            </Card>
          </DevNote>

          <DevNote note="RF603-FLU003: evidências exigidas pelo plano. Upload simulado no protótipo: o botão marca o arquivo como anexado. Leitura/medição é atendida pelas leituras do checklist; assinatura/aceite, pelo bloco abaixo.">
            <Card className="card-open" title="Fotos e evidências" subtitle={plan.evidences.length ? 'Anexe o que o plano exige' : 'O plano não exige evidências'}>
              <div className="card-body-tight">
                <Stack gap="md">
                  {plan.evidences.map((e) => {
                    const upload = isUpload(e, hasReadings);
                    const done = e === SIGNATURE ? !!(v.signedBy.trim() && v.accepted) : e === READING && hasReadings ? plan.checklist.filter((c) => c.kind === 'leitura').every((c) => (v.readings[c.id] ?? '').trim()) : v.attached.includes(e);
                    return (
                      <Stack key={e} direction="horizontal" justify="between" align="center" gap="md" wrap>
                        <Stack gap="2xs">
                          <span className="page-text"><strong>{e}</strong></span>
                          <span className="cell-secondary">{upload ? (done ? evidenceFile(e) : 'Nenhum arquivo anexado') : e === SIGNATURE ? 'Atendida pela assinatura/aceite abaixo' : 'Atendida pelas leituras do checklist'}</span>
                        </Stack>
                        <Stack direction="horizontal" gap="sm" align="center">
                          <Badge status={done ? 'success' : 'warning'} dot>{done ? 'Atendida' : 'Pendente'}</Badge>
                          {upload && !readOnly && (done
                            ? <Button size="sm" variant="ghost" iconLeft={<IconTrash size={16} />} aria-label={`Remover anexo de ${e}`} onClick={() => attach(e, false)}>Remover</Button>
                            : <Button size="sm" variant="secondary" iconLeft={/relat/i.test(e) ? <IconPaperclip size={16} /> : <IconCamera size={16} />} aria-label={`${attachLabel(e)}: ${e}`} onClick={() => attach(e, true)}>{attachLabel(e)}</Button>)}
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              </div>
            </Card>
          </DevNote>

          <DevNote note="RF603-FLU004/FLU005 / RGN002 / CTA002: com o plano em “abrir solicitação corretiva”, concluir com anomalia gera uma solicitação vinculada ao equipamento (canal Portal, problema “Outro”), que segue a triagem normal (RGN004 / P15). Com “apenas registrar”, a anomalia fica só no histórico.">
            <Card className="card-open" title="Anomalia" subtitle="Registre qualquer problema encontrado durante a preventiva">
              <div className="card-body-tight">
                <Stack gap="md">
                  <Textarea optional label="Descrição da anomalia" rows={3} disabled={readOnly} value={v.anomaly} onChange={(e) => setAnomaly(e.target.value)} />
                  {!readOnly && (
                    <Stack direction="horizontal" gap="sm" align="center" wrap>
                      <Button size="sm" variant="secondary" iconLeft={<IconCamera size={16} />} onClick={() => setAnomalyPhoto((x) => !x)}>{anomalyPhoto ? 'Remover foto da anomalia' : 'Anexar foto da anomalia'}</Button>
                      {anomalyPhoto && <span className="cell-secondary">foto-anomalia.jpg</span>}
                    </Stack>
                  )}
                  {hasAnomaly && (willOpenRequest
                    ? <Feedback type="info" title="Será aberta uma solicitação corretiva" message={`Ao concluir, o sistema abre uma solicitação para ${equipment.name}, que segue a triagem normal`} />
                    : <Feedback type="info" message="A anomalia será apenas registrada no histórico, conforme o plano" />)}
                </Stack>
              </div>
            </Card>
          </DevNote>

          <DevNote note="RF603 💡 formato da assinatura/aceite a confirmar: no protótipo, nome de quem aceitou + confirmação de aceite. Obrigatório quando o plano exige “Assinatura/aceite”.">
            <Card className="card-open" title="Assinatura / aceite" subtitle="Quem acompanhou a execução no local">
              <div className="card-body-tight">
                <Stack gap="md">
                  <Input
                    label="Nome de quem aceitou" optional={!plan.evidences.includes(SIGNATURE)} autoComplete="off" disabled={readOnly} value={v.signedBy} onChange={(e) => setSignName(e.target.value)}
                    error={tried && !readOnly && plan.evidences.includes(SIGNATURE) && !signName.trim() ? requiredMessage('Nome de quem aceitou') : undefined}
                  />
                  <Checkbox label="Confirmo o aceite" checked={v.accepted} disabled={readOnly} onChange={(e) => setAccepted(e.target.checked)} error={tried && !readOnly && plan.evidences.includes(SIGNATURE) && !accepted ? 'Confirme o aceite para concluir' : undefined} />
                </Stack>
              </div>
            </Card>
          </DevNote>

          <Card className="card-open" title="Observações">
            <div className="card-body-tight">
              <Textarea optional label="Observações" rows={3} disabled={readOnly} value={v.notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Card>

          {readOnly ? (
            <Stack direction={isMobile ? 'vertical' : 'horizontal'} gap="sm">
              <Button variant="secondary" size={isMobile ? 'lg' : 'md'} className={block} onClick={() => { window.location.href = `os.html?id=${order.id}`; }}>Ver OS</Button>
              <Button variant="ghost" size={isMobile ? 'lg' : 'md'} className={block} onClick={() => { window.location.href = 'ordens-servico.html'; }}>Voltar às ordens de serviço</Button>
            </Stack>
          ) : (
            <Stack direction={isMobile ? 'vertical' : 'horizontal'} gap="sm">
              <DevNote note="RF603-FLU006 / RGN003: grava a execução na OS, muda o status para Concluída (💡 preventiva conclui direto, sem validação do solicitante), marca a execução do plano como Concluída (histórico do equipamento e cumprimento) e registra no log.">
                <Button type="submit" size={isMobile ? 'lg' : 'md'} className={block} iconLeft={<IconCheck size={20} />}>Concluir execução</Button>
              </DevNote>
              <Button variant="ghost" size={isMobile ? 'lg' : 'md'} className={block} onClick={() => { window.location.href = 'ordens-servico.html'; }}>Cancelar</Button>
            </Stack>
          )}
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<ExecucaoScreen />);
