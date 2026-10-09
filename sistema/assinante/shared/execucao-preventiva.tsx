import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconPhoto, IconPhotoPlus, IconX } from '@tabler/icons-react';
import { Badge, Button, Card, Checkbox, Dialog, Feedback, ImageUpload, Input, Stack, Textarea, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDate, requiredMessage } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { CHECKLIST_KIND_LABEL, EvidenceFile, Execution, NO_UNIT, Request } from './data';
import { evidenceFile, executorOf } from './preventivas';
import { nextSeq, logEntry, notify, unitName, updateSubDb, useSubSession } from './store';
import { Col, Grid, ReadField, param, useRefs } from './ui';
import './preventivas.css';

/**
 * RF603 - Execução da preventiva pelo executor (interno ou prestador), pensada para o celular: tudo em coluna,
 * botões grandes. Estados: idle · incomplete (tentativa de concluir com pendências) · anomaly (com anomalia) · done (concluída, leitura).
 */
const STATES = ['idle', 'incomplete', 'anomaly', 'done'] as const;
type Mode = (typeof STATES)[number];

const READING = 'Leitura/medição';
const SIGNATURE = 'Assinatura/aceite';
const REPORT = 'Relatório técnico';
/** Leitura válida: número (0, negativos e decimais valem); vírgula ou ponto */
const validReading = (raw?: string) => { const t = (raw ?? '').trim().replace(',', '.'); return t !== '' && t !== '-' && Number.isFinite(Number(t)); };
const BEFORE_AFTER = 'Foto antes/depois';
const MOMENTS = [{ m: 'antes' as const, label: 'Antes da manutenção' }, { m: 'depois' as const, label: 'Depois da manutenção' }];
const isUpload = (label: string, hasReadings: boolean) => !(label === SIGNATURE || label === REPORT || label === READING);
const fkey = (e: string, m?: 'antes' | 'depois') => (m ? `${e}|${m}` : e);
type Picked = { name: string; url?: string };
/** Campo de arquivo no padrão do sistema (ImageUpload): abre o seletor do computador/celular; envio simulado no protótipo */
function EvidenceSlot({ label, optional, file, onChange, report }: { label: string; optional?: boolean; file?: Picked; onChange: (p: Picked | null) => void; report?: boolean }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const onFile = (f: File | null) => {
    if (!f) { onChange(null); return; }
    setLoading(true);
    timer.current = window.setTimeout(() => { onChange({ name: f.name, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined }); setLoading(false); }, 600);
  };
  return report
    ? (
      <ImageUpload
        label={label} optional={optional} fileName={file?.name} previewUrl={file?.url} loading={loading} onChange={onFile}
        accept="image/png,image/jpeg,application/pdf" helperText="JPG, PNG ou PDF"
        labels={{ add: 'Adicionar arquivo', replace: 'Trocar arquivo', remove: 'Remover arquivo', loading: 'Enviando arquivo...', invalidType: 'Envie um arquivo JPG, PNG ou PDF' }}
      />
    )
    : <ImageUpload label={label} optional={optional} fileName={file?.name} previewUrl={file?.url} loading={loading} onChange={onFile} />;
}

const ACCEPT_IMG = ['image/png', 'image/jpeg'];
const ACCEPT_REPORT = [...ACCEPT_IMG, 'application/pdf'];

/**
 * Evidência com várias fotos: vazio = área de upload do sistema (ImageUpload); com fotos = grade compacta de miniaturas
 * (clique amplia, remoção individual) e "Adicionar foto" como último item da grade, que aceita várias de uma vez.
 * Cada arquivo é validado separadamente; os inválidos não afetam os já anexados.
 */
function EvidenceGallery({ label, items, onAdd, onRemove, report }: { label: string; items: Picked[]; onAdd: (p: Picked[]) => void; onRemove: (i: number) => void; report?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const allowed = report ? ACCEPT_REPORT : ACCEPT_IMG;
  const msg = report ? 'Envie arquivos JPG, PNG ou PDF' : 'Envie imagens JPG ou PNG';
  const receive = (list: File[]) => {
    const ok = list.filter((x) => allowed.includes(x.type));
    setError(ok.length < list.length ? msg : undefined);
    if (!ok.length) return;
    setLoading(true);
    timer.current = window.setTimeout(() => { onAdd(ok.map((x) => ({ name: x.name, url: x.type.startsWith('image/') ? URL.createObjectURL(x) : undefined }))); setLoading(false); }, 600);
  };
  const noun = report ? 'arquivo' : 'foto';
  return (
    <Stack gap="sm">
      {items.length === 0 ? (
        <ImageUpload
          label={label} className="ev-hide-label" loading={loading} onChange={(x) => x && receive([x])}
          accept={allowed.join(',')} helperText={report ? 'JPG, PNG ou PDF' : 'JPG ou PNG'}
          labels={report ? { add: 'Adicionar arquivo', loading: 'Enviando arquivo...', invalidType: msg } : { invalidType: msg }}
        />
      ) : (
        <ul className="ev-grid" aria-label={`${label}: ${items.length} ${items.length === 1 ? noun : noun + 's'}`}>
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="ev-item">
              <button type="button" className="ev-thumb" onClick={() => setView(i)} aria-label={`Ampliar ${noun}: ${it.name}`}>
                {it.url ? <img src={it.url} alt="" /> : <span className="ev-ph"><IconPhoto size={24} aria-hidden="true" /><span className="ev-ph-name">{it.name}</span></span>}
              </button>
              <button type="button" className="ev-remove" onClick={() => onRemove(i)} aria-label={`Remover ${noun}: ${it.name}`}><IconX size={14} aria-hidden="true" /></button>
            </li>
          ))}
          <li className="ev-item">
            <button type="button" className="ev-add" disabled={loading} onClick={() => inputRef.current?.click()}>
              <IconPhotoPlus size={24} aria-hidden="true" />
              <span>{loading ? 'Enviando...' : `Adicionar ${noun}`}</span>
            </button>
            <input ref={inputRef} type="file" multiple accept={allowed.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { receive([...(e.target.files ?? [])]); e.target.value = ''; }} />
          </li>
        </ul>
      )}
      {error && <span className="ev-error" role="alert">{error}</span>}
      {view !== null && items[view] && (
        <Dialog open onClose={() => setView(null)} size="md" title={items[view].name} subtitle={label} actions={<Button size="sm" variant="secondary" onClick={() => setView(null)}>Fechar</Button>}>
          {items[view].url ? <img className="ev-full" src={items[view].url} alt={items[view].name} /> : <span className="cell-secondary">Pré-visualização indisponível no protótipo</span>}
        </Dialog>
      )}
    </Stack>
  );
}

function EvidenceGalleryView({ items, label }: { items: Picked[]; label: string }) {
  const [view, setView] = useState<number | null>(null);
  return (
    <>
      <ul className="ev-grid" aria-label={label}>
        {items.map((it, i) => (
          <li key={i} className="ev-item">
            <button type="button" className="ev-thumb" onClick={() => setView(i)} aria-label={`Ampliar: ${it.name}`}>
              {it.url ? <img src={it.url} alt="" /> : <span className="ev-ph"><IconPhoto size={24} aria-hidden="true" /><span className="ev-ph-name">{it.name}</span></span>}
            </button>
          </li>
        ))}
      </ul>
      {view !== null && items[view] && (
        <Dialog open onClose={() => setView(null)} size="md" title={items[view].name} subtitle={label} actions={<Button size="sm" variant="secondary" onClick={() => setView(null)}>Fechar</Button>}>
          {items[view].url ? <img className="ev-full" src={items[view].url} alt={items[view].name} /> : <span className="cell-secondary">Pré-visualização indisponível no protótipo</span>}
        </Dialog>
      )}
    </>
  );
}

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
  const [files, setFiles] = useState<Record<string, Picked[]>>({});
  const [anomalyFile, setAnomalyFile] = useState<Picked>();
  const [signName, setSignName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [showPend, setShowPend] = useState(false);
  const [report, setReport] = useState('');

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
      setSignName(user.name); setAccepted(true); setReport('Serviços realizados conforme o checklist, sem condições adversas encontradas.');
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

  // Requisitos reais da execução (cada um conta uma vez): itens obrigatórios e leituras do checklist, evidências de arquivo e assinatura/aceite
  const reqs = useMemo(() => {
    if (!plan) return [] as Array<{ key: string; label: string; done: boolean; target: string }>;
    const out: Array<{ key: string; label: string; done: boolean; target: string }> = [];
    plan.checklist.forEach((c) => {
      if (c.kind === 'obrigatorio') out.push({ key: c.id, label: c.text, done: !!checks[c.id], target: `ex-c-${c.id}` });
      if (c.kind === 'leitura') out.push({ key: c.id, label: `Leitura: ${c.text}`, done: validReading(readings[c.id]), target: `ex-c-${c.id}` });
    });
    plan.evidences.forEach((e, i) => {
      if (isUpload(e, hasReadings)) out.push({ key: `ev-${e}`, label: e, done: attached.includes(e), target: `ex-ev-${i}` });
      if (e === REPORT) out.push({ key: 'report', label: REPORT, done: !!report.trim(), target: 'ex-report' });
      if (e === SIGNATURE) out.push({ key: 'sign', label: 'Assinatura/aceite', done: !!(signName.trim() && accepted), target: 'ex-sign' });
    });
    return out;
  }, [plan, checks, readings, attached, signName, accepted, hasReadings, report]);
  const pending = reqs.filter((x) => !x.done);

  if (!order || !plan || order.kind !== 'preventiva' || !equipment) {
    return (
      <AppLayout active={param('from') === 'plano' ? 'planos' : 'os'} screen="os">
        <Feedback type="error" title="OS preventiva não encontrada" message="Abra a execução a partir de uma OS preventiva em Ordens de serviço" />
      </AppLayout>
    );
  }
  // Executor acessa só as suas OS
  if (user.profile === 'executor' && !(order.executor.kind === 'interno' && order.executor.userId === user.id)) {
    return (
      <AppLayout active={param('from') === 'plano' ? 'planos' : 'os'} screen="os">
        <Feedback type="error" title="Sem acesso a esta OS" message="Você só acessa as ordens de serviço atribuídas a você" />
      </AppLayout>
    );
  }

  const executor = executorOf(db, order.executor);
  const hasAnomaly = !!v.anomaly.trim();
  const willOpenRequest = hasAnomaly && plan.onAnomaly === 'abrir-solicitacao';
  const savedFiles = (e: string, m?: 'antes' | 'depois'): Picked[] => (saved?.evidenceFiles ?? []).filter((x) => x.evidence === e && x.moment === m).map((x) => ({ name: x.name }));
  const evItems = (label: string, m?: 'antes' | 'depois'): Picked[] => (saved
    ? (savedFiles(label, m).length ? savedFiles(label, m) : v.attached.includes(label) ? [{ name: evidenceFile(m ? `${label} ${m}` : label) }] : [])
    : files[fkey(label, m)] ?? (v.attached.includes(label) ? [{ name: evidenceFile(m ? `${label} ${m}` : label) }] : []));
  const setEv = (label: string, list: Picked[], m?: 'antes' | 'depois') => {
    const next = { ...files, [fkey(label, m)]: list };
    setFiles(next);
    const met = label === BEFORE_AFTER ? (next[fkey(label, 'antes')]?.length ?? 0) > 0 && (next[fkey(label, 'depois')]?.length ?? 0) > 0 : list.length > 0;
    setAttached((a) => (met ? [...new Set([...a, label])] : a.filter((x) => x !== label)));
  };

  const complete = () => {
    setTried(true);
    if (pending.length) { setShowPend(true); window.setTimeout(() => document.getElementById('pendencias')?.scrollIntoView({ block: 'center' }), 0); return; }
    const at = new Date().toISOString().slice(0, 19);
    const doneBy = order.executor.kind === 'interno' ? executor.primary : order.executor.technician ?? executor.primary;
    const evidenceFiles: EvidenceFile[] = attached.flatMap((a) => (a === BEFORE_AFTER
      ? MOMENTS.flatMap(({ m }) => (files[fkey(a, m)] ?? [{ name: evidenceFile(`${a} ${m}`) }]).map((x) => ({ evidence: a, moment: m, name: x.name })))
      : (files[a] ?? [{ name: evidenceFile(a) }]).map((x) => ({ evidence: a, name: x.name }))));
    const execution: Execution = { checks, readings, evidences: attached, evidenceFiles, readingsLog: plan.checklist.filter((c) => c.kind === 'leitura').map((c) => ({ id: c.id, name: c.text, unit: c.unit && c.unit !== NO_UNIT ? c.unit : '', value: (readings[c.id] ?? '').trim() })), anomaly: anomaly.trim() || undefined, notes: notes.trim() || undefined, signedBy: signName.trim() || undefined, report: report.trim() || undefined };
    let newRequest: Request | undefined;
    updateSubDb((d) => {
      let requests = d.requests;
      if (willOpenRequest) {
        const id = nextSeq('SOL', d.requests.map((r) => r.id));
        newRequest = {
          id, equipmentId: equipment.id, problemId: 'TSO-008', impact: 'medio',
          description: `Anomalia encontrada na preventiva ${order.id} (${plan.name}): ${anomaly.trim()}`, photos: anomalyPhoto || anomalyFile ? 1 : 0,
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
          files: [...o.files, ...evidenceFiles.map((x, j) => ({ id: `EX-${Date.now()}-${j}`, name: x.name, kind: 'foto' as const, at, by: user.name, evidence: x.evidence, moment: x.moment }))],
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

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => el.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true }), 250);
  };
  const metCount = reqs.filter((x) => x.done).length;
  const plainItems = plan.checklist.filter((c) => c.kind !== 'leitura');
  const readingItems = plan.checklist.filter((c) => c.kind === 'leitura');
  const uploads = plan.evidences.map((e, i) => ({ e, i })).filter((x) => isUpload(x.e, hasReadings));
  const block = isMobile ? 'btn-block' : undefined;
  const checkError = (id: string) => (tried && !readOnly && !checks[id] ? 'Marque este item para concluir' : undefined);

  return (
    <AppLayout active={param('from') === 'plano' ? 'planos' : 'os'} screen="os">
      <form className="form-page" onSubmit={(e) => { e.preventDefault(); if (!readOnly) complete(); }} noValidate>
        <Stack gap="lg">
          <PageHeader
            title="Executar preventiva" subtitle={`${order.id} · ${plan.name}`} badge={refs.statusBadge(order.statusId)}
            breadcrumb={param('from') === 'plano'
              ? [{ label: 'Planos de manutenção', href: 'planos.html' }, { label: plan.name, href: `plano.html?id=${plan.id}` }, { label: 'Executar preventiva' }]
              : [{ label: 'Ordens de serviço', href: 'ordens-servico.html' }, { label: order.id, href: `os.html?id=${order.id}` }, { label: 'Executar preventiva' }]}
          />

          {(isDone || demoDone) && (
            <Feedback
              type="success" title="Execução concluída"
              message={`Concluída por ${executor.primary}. O histórico do equipamento e o cumprimento do plano foram atualizados${isDone ? '' : ' (exemplo de demonstração)'}`}
            />
          )}
          {cancelled && <Feedback type="warning" title="OS cancelada" message={order.cancelReason ?? 'Esta OS foi cancelada e não pode ser executada'} />}
          {!can('os', 'editar') && !isDone && !demoDone && <Feedback type="info" message="Seu perfil só visualiza esta execução" />}

          <Card className="card-open" title="Dados da OS">
            <div className="card-body-tight">
              <div className="ex-meta">
                <ReadField label="Equipamento" value={<a className="text-link" href={`equipamento.html?id=${equipment.id}`}>{equipment.name}</a>} />
                <ReadField label="Unidade" value={unitName(db, equipment.unitId)} />
                <ReadField label="Data prevista" value={formatDate(order.dueAt)} />
                <ReadField label="Executor" value={executor.primary} />
              </div>
            </div>
          </Card>

          {!readOnly && reqs.length > 0 && (
            <div id="pendencias" tabIndex={-1}>
              <DevNote note="RF603-RGN001 / CTA001: não é possível concluir sem os itens obrigatórios (checklist e leituras) e as evidências obrigatórias do plano. O progresso conta cada requisito uma vez; as pendências levam ao campo correspondente. Concluir continua dependendo da ação final.">
                <Card className="card-open" title="Progresso da execução">
                  <div className="card-body-tight">
                    <Stack gap="sm">
                      <div className="ex-prog">
                        <span className="ex-prog-text">{`${metCount} de ${reqs.length} requisitos atendidos`}</span>
                        <span className={`ex-prog-pend${tried && pending.length ? ' is-error' : ''}`}>{pending.length ? `${pending.length} ${pending.length === 1 ? 'pendência' : 'pendências'}` : 'Nenhuma pendência'}</span>
                        {pending.length > 0 && (
                          <Button size="sm" variant="ghost" aria-expanded={showPend} aria-controls="ex-pend-list" onClick={() => setShowPend((x) => !x)}>{showPend ? 'Ocultar pendências' : 'Ver pendências'}</Button>
                        )}
                      </div>
                      <div className="ex-bar" role="progressbar" aria-label="Progresso da execução" aria-valuemin={0} aria-valuemax={reqs.length} aria-valuenow={metCount}><span style={{ width: `${(metCount / reqs.length) * 100}%` }} /></div>
                      {showPend && pending.length > 0 && (
                        <ul id="ex-pend-list" className="ex-pend">
                          {pending.map((x) => <li key={x.key}><button type="button" className="text-link" onClick={() => jump(x.target)}>{x.label}</button></li>)}
                        </ul>
                      )}
                    </Stack>
                  </div>
                </Card>
              </DevNote>
            </div>
          )}

          {plainItems.length > 0 && (
            <DevNote note="RF603-FLU002: cada procedimento do checklist é marcado. Obrigatórios precisam ser marcados; opcionais, não.">
              <Card className="card-open" title="Checklist" subtitle="Marque os procedimentos realizados">
                <div className="card-body-tight">
                  <ul className="ex-list">
                    {plainItems.map((c) => (
                      <li key={c.id} id={`ex-c-${c.id}`} className="ex-row">
                        <Checkbox label={c.text} checked={!!v.checks[c.id]} disabled={readOnly} onChange={(e) => setChecks((x) => ({ ...x, [c.id]: e.target.checked }))} error={c.kind === 'obrigatorio' ? checkError(c.id) : undefined} />
                        <span className="ex-tag">{CHECKLIST_KIND_LABEL[c.kind]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </DevNote>
          )}

          {readingItems.length > 0 && (
            <DevNote note="RF603-FLU002: medições configuradas no plano (itens de leitura do checklist, mesma fonte, sem duplicar). Todas são obrigatórias; aceita 0, negativos e decimais, sem faixas de aceitação. Ao concluir, nome, unidade e valor ficam gravados na execução (histórico).">
              <Card className="card-open" title="Leituras e medições" subtitle="Registre os valores solicitados pelo plano">
                <div className="card-body-tight">
                  <ul className="ex-list">
                    {readingItems.map((c) => (
                      <li key={c.id} id={`ex-c-${c.id}`} className="ex-row is-reading">
                        <div className="ex-reading">
                          <Input
                            label={c.text} inputMode="decimal" disabled={readOnly} value={v.readings[c.id] ?? ''} required
                            onChange={(e) => setReadings((r) => ({ ...r, [c.id]: e.target.value.replace(/[^\d.,-]/g, '') }))}
                            iconRight={c.unit && c.unit !== NO_UNIT ? <span className="cell-secondary">{c.unit}</span> : undefined}
                            error={tried && !readOnly && !validReading(v.readings[c.id]) ? ((v.readings[c.id] ?? '').trim() ? 'Informe um valor numérico' : requiredMessage('Leitura')) : undefined}
                          />
                        </div>
                        <span className="ex-tag">Obrigatória</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </DevNote>
          )}

          {uploads.length > 0 && (
            <DevNote note="RF603-FLU003: fotos exigidas pelo plano. Foto antes/depois = ao menos 1 foto antes e 1 depois (guardadas com o momento, independentemente do nome ou da ordem); Foto da placa = ao menos 1 imagem, em grupo próprio. O campo de arquivo é o do restante do sistema (envio simulado no protótipo).">
              <Card className="card-open" title="Fotos da execução" subtitle="Registre as imagens solicitadas pelo plano">
                <div className="card-body-tight">
                  <Stack gap="md">
                  {uploads.map(({ e, i }) => {
                    const done = v.attached.includes(e);
                    const ba = e === BEFORE_AFTER;
                    const items = evItems(e);
                    return (
                      <div key={e} id={`ex-ev-${i}`} className="ev-req"><Stack gap="sm">
                        <Stack direction="horizontal" justify="between" align="center" gap="md" wrap>
                          <Stack gap="2xs">
                            <span className="page-text"><strong>{e}</strong></span>
                            {readOnly && !done && <span className="cell-secondary">Nenhum arquivo anexado</span>}
                          </Stack>
                          <Badge status={done ? 'success' : 'warning'} dot>{done ? 'Atendida' : 'Pendente'}</Badge>
                        </Stack>
                        {readOnly && !ba
                          ? items.length > 0 && <EvidenceGalleryView items={items} label={e} />
                          : ba
                          ? (
                            <Stack gap="md">
                              {MOMENTS.map(({ m, label }) => {
                                const list = evItems(e, m);
                                return (
                                  <Stack key={m} gap="xs">
                                    <span className="page-label">{label}</span>
                                    {readOnly
                                      ? (list.length ? <EvidenceGalleryView items={list} label={`${e} - ${label.toLowerCase()}`} /> : <span className="cell-secondary">Nenhuma foto</span>)
                                      : <EvidenceGallery label={`${e} - ${label.toLowerCase()}`} items={list} onAdd={(p) => setEv(e, [...list, ...p], m)} onRemove={(k) => setEv(e, list.filter((_, n) => n !== k), m)} />}
                                  </Stack>
                                );
                              })}
                            </Stack>
                          )
                          : <EvidenceGallery label={e} items={items} onAdd={(p) => setEv(e, [...items, ...p])} onRemove={(k) => setEv(e, items.filter((_, n) => n !== k))} />}
                      </Stack></div>
                    );
                  })}
                  </Stack>
                </div>
              </Card>
            </DevNote>
          )}

          {plan.evidences.includes(REPORT) && (
            <DevNote note="RF603: relatório técnico preenchido direto no sistema (texto livre, também pelo celular); obrigatório para concluir quando exigido pelo plano. Sem campos adicionais nesta etapa.">
              <div id="ex-report">
                <Card className="card-open" title="Relatório técnico" subtitle="Descreva os serviços realizados e as condições encontradas">
                  <div className="card-body-tight">
                    <Textarea
                      aria-label={REPORT} rows={5} required disabled={readOnly} value={readOnly ? saved?.report ?? '' : report} onChange={(e) => setReport(e.target.value)}
                      error={tried && !readOnly && !report.trim() ? requiredMessage('Relatório técnico') : undefined}
                    />
                  </div>
                </Card>
              </div>
            </DevNote>
          )}

          <DevNote note="RF603-FLU004/FLU005 / RGN002 / CTA002: com o plano em “abrir solicitação corretiva”, concluir com anomalia gera uma solicitação vinculada ao equipamento (canal Portal, problema “Outro”), que segue a triagem normal (RGN004 / P15). Com “apenas registrar”, a anomalia fica só no histórico.">
            <Card className="card-open" title="Anomalia" subtitle="Registre qualquer problema encontrado durante a preventiva">
              <div className="card-body-tight">
                <Stack gap="md">
                  <Textarea optional label="Descrição da anomalia" rows={3} disabled={readOnly} value={v.anomaly} onChange={(e) => setAnomaly(e.target.value)} />
                  {!readOnly && (
                    <EvidenceSlot
                      label="Foto da anomalia" optional file={anomalyFile ?? (anomalyPhoto ? { name: 'foto-anomalia.jpg' } : undefined)}
                      onChange={(p) => { setAnomalyFile(p ?? undefined); setAnomalyPhoto(!!p); }}
                    />
                  )}
                  {hasAnomaly && (willOpenRequest
                    ? <Feedback type="info" title="Será aberta uma solicitação corretiva" message={`Ao concluir, o sistema abre uma solicitação para ${equipment.name}, que segue a triagem normal`} />
                    : <Feedback type="info" message="A anomalia será apenas registrada no histórico, conforme o plano" />)}
                </Stack>
              </div>
            </Card>
          </DevNote>

          <Card className="card-open" title="Observações" subtitle="Registre informações adicionais sobre a execução, se necessário">
            <div className="card-body-tight">
              <Textarea aria-label="Observações" rows={3} disabled={readOnly} value={v.notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Card>

          {(plan.evidences.includes(SIGNATURE) || !!v.signedBy) && (
          <DevNote note="RF603 💡 formato da assinatura/aceite a confirmar: no protótipo, nome de quem aceitou + confirmação de aceite. Obrigatório quando o plano exige “Assinatura/aceite”.">
            <div id="ex-sign"><Card className="card-open" title="Assinatura / aceite" subtitle="Quem acompanhou a execução no local">
              <div className="card-body-tight">
                <Stack gap="md">
                  <Input
                    label="Nome de quem aceitou" optional={!plan.evidences.includes(SIGNATURE)} autoComplete="off" disabled={readOnly} value={v.signedBy} onChange={(e) => setSignName(e.target.value)}
                    error={tried && !readOnly && plan.evidences.includes(SIGNATURE) && !signName.trim() ? requiredMessage('Nome de quem aceitou') : undefined}
                  />
                  <Checkbox label="Confirmo o aceite" checked={v.accepted} disabled={readOnly} onChange={(e) => setAccepted(e.target.checked)} error={tried && !readOnly && plan.evidences.includes(SIGNATURE) && !accepted ? 'Confirme o aceite para concluir' : undefined} />
                </Stack>
              </div>
            </Card></div>
          </DevNote>
          )}


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
