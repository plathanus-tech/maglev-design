import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IconBulb } from '@tabler/icons-react';
import { Button, Card, Checkbox, Dropdown, EmptyState, Feedback, ImageUpload, Input, RadioButton, Stack, Table, TableColumn, Textarea } from '@maglev/ds';
import { MobileCardList } from '../../admin/shared/MobileCardList';
import { useIsMobile } from '../../admin/shared/useMediaQuery';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { formatDateTime, formatPhone, isValidPhone, noBreak, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { IMPACT_LABEL, Impact, Request, TipResult, TroubleshootingRun, nowLocal } from './data';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { logEntry, nextSeq, notify, updateSubDb, useSubSession } from './store';
import { CellPair, Col, Grid, goTo, param, setFlash, useRefs } from './ui';
import { IS_THUMB, STS, isOpenBase } from './solicitacoes-shared';

import './solicitacao-form.css';

/** Estados: idle · required · duplicate (aviso de duplicidade) · troubleshooting (aviso + Começar) · tip1 · lasttip · tipsdone (volta ao formulário) · resolved */
const STATES = ['idle', 'required', 'duplicate', 'troubleshooting', 'tip1', 'lasttip', 'tipsdone', 'resolved'] as const;
type Mode = (typeof STATES)[number];
type Stage = 'form' | 'tips' | 'resolved';
const MAX_PHOTOS = 5;
const DESC_MAX = 1000;

type ExistingRow = Record<string, unknown> & { id: string; r: Request };
const shortText = (t: string) => (t.length > 48 ? `${t.slice(0, 48)}…` : t);

/** Foto da solicitação: ImageUpload do DS (o mesmo do Novo equipamento) com envio simulado; sem foto é o slot vazio que adiciona a próxima. */
function PhotoSlot({ label, optional, photo, onChange }: { label: string; optional?: boolean; photo?: { name: string; url: string }; onChange: (p: { name: string; url: string } | null) => void }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const onFile = (file: File | null) => {
    if (!file) { onChange(null); return; }
    setLoading(true);
    timer.current = window.setTimeout(() => { onChange({ name: file.name, url: URL.createObjectURL(file) }); setLoading(false); }, 600);
  };
  return <ImageUpload label={label} optional={optional} fileName={photo?.name} previewUrl={photo?.url} loading={loading} onChange={onFile} />;
}

function SolicitacaoFormScreen() {
  const refs = useRefs();
  const { db, user, can, unitIds } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');

  const activeUnits = db.units.filter((u) => u.status === 'ativo' && unitIds.includes(u.id));
  const usable = (eid?: string | null) => db.equipments.find((e) => e.id === eid && e.statusId !== 'STE-05' && activeUnits.some((u) => u.id === e.unitId));
  const fromUrl = usable(param('equipment'));

  const [unitId, setUnitId] = useState(fromUrl?.unitId ?? '');
  const [equipmentId, setEquipmentId] = useState(fromUrl?.id ?? '');
  const [problemId, setProblemId] = useState('');
  const [impact, setImpact] = useState<Impact | ''>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [related, setRelated] = useState('');
  const [prevNote, setPrevNote] = useState('');
  const [contactName, setContactName] = useState(user.name);
  const [contactPhone, setContactPhone] = useState(formatPhone(user.phone));
  const [tried, setTried] = useState(false);
  const [tick, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  // Troubleshooting (RF403)
  const [stage, setStage] = useState<Stage>('form');
  const [tipIdx, setTipIdx] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const [run, setRun] = useState<TroubleshootingRun>({ overall: 'nao-iniciado', tips: [] });
  const [finished, setFinished] = useState(false);
  const [resolvedId, setResolvedId] = useState('');

  const equipment = db.equipments.find((e) => e.id === equipmentId);
  const tips = equipment?.troubleshooting.find((t) => t.problemId === problemId)?.tips ?? [];
  const problemName = refs.requestType(problemId)?.name ?? '';
  const openOnes = useMemo(() => db.requests.filter((r) => r.equipmentId === equipmentId && isOpenBase(refs.base(r.statusId))).sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.requests, equipmentId, refs.admin]);

  // Variantes de demonstração: equipamento com dicas e sem solicitação aberta (ou, para duplicidade, com solicitação aberta)
  useEffect(() => {
    if (mode === 'idle') return;
    const eqs = db.equipments.filter((e) => usable(e.id));
    const hasOpen = (id: string) => db.requests.some((r) => r.equipmentId === id && isOpenBase(refs.base(r.statusId)));
    if (mode === 'required') { setTried(true); setTick((n) => n + 1); return; }
    if (mode === 'duplicate') {
      const e = eqs.find((x) => hasOpen(x.id));
      if (e) { setUnitId(e.unitId); setEquipmentId(e.id); setProblemId('TSO-002'); }
      return;
    }
    const withTips = eqs.filter((e) => e.troubleshooting.length).sort((a, b) => Number(hasOpen(a.id)) - Number(hasOpen(b.id)) || Math.max(...b.troubleshooting.map((t) => t.tips.length)) - Math.max(...a.troubleshooting.map((t) => t.tips.length)));
    const e = withTips[0];
    if (!e) return;
    const entry = [...e.troubleshooting].sort((a, b) => b.tips.length - a.tips.length)[0];
    setUnitId(e.unitId); setEquipmentId(e.id); setProblemId(entry.problemId);
    if (mode === 'tip1') { setDone(entry.tips.map(() => false)); setStage('tips'); setTipIdx(0); }
    if (mode === 'lasttip') { setDone(entry.tips.map((_, k) => k % 2 === 0)); setStage('tips'); setTipIdx(entry.tips.length - 1); }
    if (mode === 'tipsdone') { setFinished(true); setRun({ overall: 'sem-sucesso', tips: entry.tips.map((t, k) => ({ text: t.text, result: k % 2 === 0 ? 'realizada' : 'pulada' })) }); }
    if (mode === 'resolved') setStage('resolved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Opções ──
  const equipmentOptions = db.equipments
    .filter((e) => usable(e.id) && (!unitId || e.unitId === unitId))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((e) => ({ value: e.id, label: e.name, description: `${e.code}${unitId ? '' : ` · ${db.units.find((u) => u.id === e.unitId)?.name}`}`, keywords: e.code }));
  const isMobile = useIsMobile();
  const existingCols: TableColumn<ExistingRow>[] = [
    { key: 'id', label: 'Protocolo', render: (_, row) => <a className="text-link" href={`solicitacao.html?id=${row.r.id}`}>{noBreak(row.r.id)}</a> },
    { key: 'type', label: 'Tipo de solicitação / Descrição', render: (_, row) => <CellPair primary={refs.requestType(row.r.problemId)?.name ?? '-'} secondary={shortText(row.r.description)} /> },
    { key: 'r', label: 'Aberta em', render: (_, row) => noBreak(formatDateTime(row.r.openedAt)) },
    { key: 'status', label: 'Status', render: (_, row) => refs.statusBadge(row.r.statusId) },
  ];
  const typeOptions = refs.admin.requestTypes.filter((t) => t.status === 'ativo').map((t) => ({ value: t.id, label: t.name }));

  const problems = {
    unit: !unitId ? requiredMessage('Unidade') : undefined,
    equipment: !equipmentId ? requiredMessage('Equipamento') : undefined,
    problem: !problemId ? requiredMessage('Tipo de solicitação') : undefined,
    impact: !impact ? requiredMessage('Impacto') : undefined,
    description: !description.trim() ? requiredMessage('Descrição') : undefined,
    related: !related ? requiredMessage('Relacionado a reparo anterior') : undefined,
    name: !contactName.trim() ? requiredMessage('Nome para contato') : undefined,
    phone: !onlyDigits(contactPhone) ? requiredMessage('Telefone para contato') : !isValidPhone(contactPhone) ? 'Informe um telefone válido' : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);

  useEffect(() => {
    if (!tick) return;
    if (Object.values(problems).filter(Boolean).length > 1) setBanner(true);
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const pickUnit = (v: string) => { setUnitId(v); if (equipment && equipment.unitId !== v) { setEquipmentId(''); setProblemId(''); } };
  const pickEquipment = (v: string) => {
    const e = db.equipments.find((x) => x.id === v);
    setEquipmentId(v); setDupDismissed(false); resetRun();
    if (e) setUnitId(e.unitId);
  };
  const pickProblem = (v: string) => { setProblemId(v); resetRun(); };
  function resetRun() { setRun({ overall: 'nao-iniciado', tips: [] }); setFinished(false); setDone([]); setTipIdx(0); }

  // ── Troubleshooting ──
  const start = () => { setDone(tips.map(() => false)); setTipIdx(0); setStage('tips'); window.scrollTo({ top: 0 }); };
  const resultsUpTo = (n: number): Array<{ text: string; result: TipResult }> => tips.slice(0, n + 1).map((t, k) => ({ text: t.text, result: done[k] ? 'realizada' : 'pulada' }));
  const toggleDone = (v: boolean) => setDone((d) => d.map((x, k) => (k === tipIdx ? v : x)));
  const solved = () => {
    // CTA002: conclui sem criar solicitação para triagem e registra a ocorrência no histórico do equipamento
    const results = tips.slice(0, tipIdx + 1).map((t, k): { text: string; result: TipResult } => ({ text: t.text, result: k === tipIdx || done[k] ? 'realizada' : 'pulada' }));
    if (!IS_THUMB && mode !== 'resolved' && equipment) {
      const db0 = JSON.parse(JSON.stringify(db)) as typeof db;
      const id = nextSeq('SOL', db0.requests.map((r) => r.id));
      const r: Request = {
        id, equipmentId: equipment.id, problemId, impact: impact || 'baixo', description: `Resolvida na solução de problemas (dica nº ${tipIdx + 1}): ${problemName}`, photos: 0,
        requesterName: user.name, requesterPhone: user.phone, requesterUserId: user.id, channel: 'Portal', openedAt: nowLocal(), statusId: STS.DONE, statusChangedAt: nowLocal(),
        previousRepair: { related: false }, troubleshooting: { overall: 'resolvido', tips: results }, closeReason: 'Resolvida no troubleshooting',
        log: [logEntry(user.name, 'Abriu a solicitação'), logEntry(user.name, `Concluída sem OS: resolvida no troubleshooting (dica nº ${tipIdx + 1})`)],
      };
      updateSubDb((d) => ({ ...d, requests: [...d.requests, { ...r, id: nextSeq('SOL', d.requests.map((x) => x.id)) }] }));
      setResolvedId(r.id);
    }
    setRun({ overall: 'resolvido', tips: results });
    setStage('resolved');
    window.scrollTo({ top: 0 });
  };
  const next = () => { setTipIdx((i) => i + 1); };
  const noSuccess = () => {
    setRun({ overall: 'sem-sucesso', tips: resultsUpTo(tipIdx) });
    setFinished(true); setStage('form');
    window.scrollTo({ top: 0 });
  };

  // ── Envio ──
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true); setBanner(false); setTick((n) => n + 1);
    if (invalid || !equipment) return;
    setSaving(true);
    let id = '';
    updateSubDb((d) => {
      id = nextSeq('SOL', d.requests.map((r) => r.id));
      const created: Request = {
        id, equipmentId: equipment.id, problemId, impact: impact as Impact, description: description.trim(), photos: photos.length,
        requesterName: contactName.trim(), requesterPhone: onlyDigits(contactPhone), requesterUserId: user.id, channel: 'Portal',
        openedAt: nowLocal(), statusId: STS.NEW, statusChangedAt: nowLocal(),
        previousRepair: related === 'sim' ? { related: true, note: prevNote.trim() || undefined } : { related: false },
        troubleshooting: run, log: [logEntry(user.name, 'Abriu a solicitação')],
      };
      return { ...d, requests: [...d.requests, created] };
    });
    // Notifica quem faz a triagem: Administradores e Gestores de manutenção (RF404-FLU006)
    const triagers = db.users.filter((u) => u.status === 'ativo' && (u.profile === 'administrador' || u.profile === 'gestor') && u.id !== user.id).map((u) => u.id);
    notify(triagers, { title: 'Nova solicitação aberta', text: `${id}: ${equipment.name} · ${problemName} (impacto ${IMPACT_LABEL[impact as Impact].toLowerCase()})`, href: `solicitacao.html?id=${id}`, kind: 'solicitacao' });
    setFlash({ type: 'success', title: 'Solicitação enviada com sucesso!', message: `Protocolo ${id}. Sua solicitação foi encaminhada para análise.` });
    window.setTimeout(() => goTo(can('solicitacoes', 'triar') ? `solicitacao.html?id=${id}` : 'solicitacoes.html'), 400);
  };

  const header = (
    <PageHeader
      title="Nova solicitação"
      subtitle="Descreva o problema identificado no equipamento"
      breadcrumb={[{ label: 'Solicitações', href: 'solicitacoes.html' }, { label: 'Nova solicitação' }]}
    />
  );

  // ── Resolvido no troubleshooting ──
  if (stage === 'resolved') {
    return (
      <AppLayout active="solicitacoes" screen="solicitacoes">
        <Stack gap="xl">
          {header}
          <DevNote note="RF403-FLU004 / CTA002: “Isso resolveu o problema!” encerra o fluxo sem abrir solicitação para triagem. É criado um registro Concluída sem OS (resolvida no troubleshooting) e a ocorrência fica no histórico do equipamento.">
            <Feedback type="success" title="Problema resolvido" message={`Que bom que deu certo${equipment ? `: ${equipment.name} voltou a funcionar` : ''}. Nenhuma solicitação foi enviada para análise`} />
          </DevNote>
          <Card>
            <EmptyState
              title="Ocorrência registrada"
              description={`A solução ficou registrada no histórico do equipamento${resolvedId ? ` (${resolvedId})` : ''}.`}
              headingLevel={2}
              action={(
                <Stack direction="horizontal" gap="sm" wrap justify="center">
                  <Button onClick={() => goTo('solicitacoes.html')}>Voltar às solicitações</Button>
                  {equipment && <Button variant="secondary" onClick={() => goTo(`equipamento.html?id=${equipment.id}`)}>Ver equipamento</Button>}
                </Stack>
              )}
            />
          </Card>
        </Stack>
      </AppLayout>
    );
  }

  // ── Dicas ──
  if (stage === 'tips' && tips.length) {
    const last = tipIdx === tips.length - 1;
    const pct = Math.round(((tipIdx + 1) / tips.length) * 100);
    return (
      <AppLayout active="solicitacoes" screen="solicitacoes">
        <Stack gap="xl" className="form-page">
          {header}
          <DevNote note="RF403-FLU002/FLU003, RGN005 e CTA004: uma dica por tela, da mais simples à mais complexa, com barra de progresso. “Próxima dica” sem marcar “Testei esta dica” registra Pulada; marcando, Realizada. É possível voltar à dica anterior. Na última dica, o botão vira “Sem sucesso? Envie uma solicitação”. Etapas de risco (elétrica, gás) só orientam a observar (RGN002).">
            <Card
              className="card-open ts-step" title="Solução de problemas" subtitle={`${equipment?.name} · ${problemName}`}
              actions={<span className="ts-count" aria-hidden="true">{tipIdx + 1} de {tips.length}</span>}
            >
              <div className="card-body-tight">
                <Stack gap="lg">
                  <div className="tip-progress" role="progressbar" aria-label="Progresso das dicas" aria-valuemin={0} aria-valuemax={tips.length} aria-valuenow={tipIdx + 1} aria-valuetext={`Dica ${tipIdx + 1} de ${tips.length}`}>
                    <div className="tip-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="ts-instruction" aria-live="polite">
                    <span className="ts-instruction-icon" aria-hidden="true"><IconBulb size={24} /></span>
                    <p className="ts-instruction-text">{tips[tipIdx].text}</p>
                  </div>
                  <div className="ts-attempt">
                    <Checkbox label="Testei esta dica" checked={!!done[tipIdx]} onChange={(e) => toggleDone(e.target.checked)} />
                  </div>
                  <Stack gap="md" className="ts-actions">
                    <Button className="ts-primary" onClick={solved}>Isso resolveu o problema!</Button>
                    <div className="ts-nav">
                      <Button variant="secondary" disabled={tipIdx === 0} onClick={() => setTipIdx((i) => i - 1)}>Dica anterior</Button>
                      {last
                        ? <Button variant="secondary" onClick={noSuccess}>Sem sucesso? Envie uma solicitação</Button>
                        : <Button variant="secondary" onClick={next}>Próxima dica</Button>}
                    </div>
                  </Stack>
                  <div className="ts-back"><Button variant="ghost" size="sm" onClick={() => { setStage('form'); resetRun(); }}>Voltar ao formulário</Button></div>
                </Stack>
              </div>
            </Card>
          </DevNote>
        </Stack>
      </AppLayout>
    );
  }

  const showTsOffer = !!equipment && !!problemId && tips.length > 0 && !finished && run.overall === 'nao-iniciado';

  return (
    <AppLayout active="solicitacoes" screen="solicitacoes">
      <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(false)} noValidate>
        <Stack gap="xl">
          {header}
          {banner && (
            <div className="floating-feedback">
              <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(false)} />
            </div>
          )}
          {finished && (
            <DevNote note="RF403-FLU005: na última dica, sem solução, o usuário volta ao formulário com a mensagem “Solução de problemas concluída”. A solicitação segue com as notas (cada dica e Realizada/Pulada; resultado geral Sem sucesso - FLU006).">
              <Feedback type="success" title="Solução de problemas concluída" message="As dicas tentadas serão enviadas junto com a solicitação. Complete os dados e envie a solicitação para análise" />
            </DevNote>
          )}

          <Card className="card-open" title="Equipamento" subtitle="Escolha a unidade e o equipamento com o problema">
            <div className="card-body-tight">
              <Grid>
                <Col span={12}>
                  <DevNote note="RF404-FLU002: apenas unidades ativas e do perfil do usuário. Equipamento localizado por nome ou código/patrimônio, sem QR Code (CTA002), filtrado pela unidade; só equipamentos ativos. Pré-selecionado quando vem do ativo (?equipment=).">
                    <Dropdown label="Unidade" required placeholder="Selecione a unidade" options={activeUnits.map((u) => ({ value: u.id, label: u.name }))} value={unitId} onChange={pickUnit} error={show('unit')} />
                  </DevNote>
                </Col>
                <Col span={12}>
                  <Dropdown label="Equipamento" required placeholder="Buscar por nome ou código/patrimônio" searchable searchPlaceholder="Buscar por nome ou código/patrimônio" searchLabel="Buscar equipamento por nome ou código/patrimônio" emptyText="Nenhum equipamento encontrado" options={equipmentOptions} value={equipmentId} onChange={pickEquipment} error={show('equipment')} />
                </Col>
              </Grid>
            </div>
          </Card>

          {equipment && openOnes.length > 0 && !dupDismissed && (
            <DevNote note="RF404-FLU003 / RGN004 / CTA003: com solicitações abertas para o equipamento, o sistema avisa e lista os protocolos; o usuário pode acompanhar uma existente ou seguir com a nova. O aviso não impede o envio.">
              <Stack gap="md">
                <Feedback
                  type="warning" title="Já existem solicitações abertas para este equipamento"
                  message="Confira se o seu problema já foi informado. Você pode acompanhar uma delas ou seguir com a nova solicitação"
                  dismissible onDismiss={() => setDupDismissed(true)}
                />
                {isMobile ? (
                  <MobileCardList
                    headingId="existing-title" title="Acompanhar uma solicitação existente" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" emptyTitle="Nenhuma solicitação aberta"
                    page={1} pageSize={Math.max(1, openOnes.length)} total={openOnes.length} onPageChange={() => undefined}
                    items={openOnes.map((r) => ({ id: r.id, title: <a className="text-link" href={`solicitacao.html?id=${r.id}`}>{r.id}</a>, subtitle: refs.requestType(r.problemId)?.name ?? '-', badge: refs.statusBadge(r.statusId), fields: [{ label: 'Descrição', value: shortText(r.description) }, { label: 'Aberta em', value: formatDateTime(r.openedAt) }] }))}
                  />
                ) : (
                  <Table<ExistingRow> title="Acompanhar uma solicitação existente" subtitle="Verifique se o mesmo problema já foi registrado em outra solicitação" columns={existingCols} rows={openOnes.map((r) => ({ id: r.id, r }))} />
                )}
              </Stack>
            </DevNote>
          )}

          <Card className="card-open" title="Problema" subtitle="Conte o que está acontecendo">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><Dropdown label="Tipo de solicitação" required placeholder="Selecione" options={typeOptions} value={problemId} onChange={pickProblem} error={show('problem')} /></Col>
                <Col span={6}>
                  <DevNote note="💡 Impacto: sugestão Baixo / Médio / Alto, a confirmar. A triagem usa o impacto na matriz de prioridade (Admin RF405).">
                    <RadioButton name="impact" label="Impacto" orientation="horizontal" options={(Object.keys(IMPACT_LABEL) as Impact[]).map((v) => ({ value: v, label: IMPACT_LABEL[v] }))} value={impact} onChange={(v) => setImpact(v as Impact)} error={show('impact')} />
                  </DevNote>
                </Col>
                {showTsOffer && (
                  <Col span={12}>
                    <DevNote note="RF403-FLU001 / RF404-RGN006: o troubleshooting é oferecido depois de escolher equipamento e tipo de solicitação, se houver dicas cadastradas (CTA001). Iniciar é opcional (RGN008): se não iniciar, a solicitação registra “Não iniciado”. Sem dicas, segue direto para o envio (RGN004).">
                      <Card
                        className="ts-offer" padding="none" title={<span className="ts-offer-title"><IconBulb size={20} aria-hidden="true" />Solução de problemas</span>}
                        subtitle={`Antes de enviar a solicitação, confira ${tips.length === 1 ? 'esta dica' : `estas ${tips.length} dicas`} para tentar resolver o problema`}
                        actions={<Button onClick={start}>Começar</Button>}
                      />
                    </DevNote>
                  </Col>
                )}
                <Col span={12}>
                  <Textarea
                    label="Descrição" required rows={5} maxLength={DESC_MAX} value={description} onChange={(e) => setDescription(e.target.value)} error={show('description')}
                    helperText={`${description.length}/${DESC_MAX} caracteres`}
                  />
                </Col>
                <Col span={12}>
                  <DevNote note="💡 RF404: quantidade e tamanho máximos das fotos a definir (aqui, até 5). Envio simulado no protótipo.">
                    <Stack gap="md">
                      {photos.map((p, i) => (
                        <PhotoSlot
                          key={`${p.name}-${i}`} label={i === 0 ? 'Fotos' : `Foto ${i + 1}`} optional={i === 0} photo={p}
                          onChange={(next) => setPhotos((l) => (next ? l.map((x, k) => (k === i ? next : x)) : l.filter((_, k) => k !== i)))}
                        />
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <PhotoSlot key={`new-${photos.length}`} label={photos.length === 0 ? 'Fotos' : `Foto ${photos.length + 1}`} optional={photos.length === 0} onChange={(next) => next && setPhotos((l) => [...l, next])} />
                      )}
                    </Stack>
                  </DevNote>
                </Col>
                <Col span={12}>
                  <DevNote note="RF404 (v0.4): “Relacionado a reparo anterior?” é obrigatório (Sim/Não); a observação é opcional e não exige vincular protocolo. O reparo também tem garantia.">
                    <RadioButton name="related" label="Relacionado a reparo anterior?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} value={related} onChange={setRelated} error={show('related')} />
                  </DevNote>
                </Col>
                {related === 'sim' && (
                  <Col span={12}><Textarea label="Observação do reparo anterior" optional rows={3} value={prevNote} onChange={(e) => setPrevNote(e.target.value)} placeholder="Ex.: o técnico veio ontem trocar o termostato" /></Col>
                )}
              </Grid>
            </div>
          </Card>

          <Card className="card-open" title="Contato para retorno" subtitle="Usaremos estes dados para falar com você sobre a solicitação">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><Input label="Nome" required autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} error={show('name')} /></Col>
                <Col span={6}><Input label="Telefone" required type="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={contactPhone} onChange={(e) => setContactPhone(formatPhone(e.target.value))} error={show('phone')} /></Col>
              </Grid>
            </div>
          </Card>

          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitação'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => goTo('solicitacoes.html')}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<SolicitacaoFormScreen />);
