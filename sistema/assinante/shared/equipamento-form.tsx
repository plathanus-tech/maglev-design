import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowDown, IconArrowUp, IconCopy, IconGripVertical, IconPhoto, IconPlus, IconTrash } from '@tabler/icons-react';
import { Accordion, Button, Card, DatePicker, Dropdown, Feedback, ImageUpload, Input, RadioButton, Stack, Textarea, Tooltip, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { formatMoney, onlyDigits, requiredMessage } from '../../admin/shared/format';
import { Equipment, TroubleshootingEntry, dayOnly, hoursAgo, nowLocal } from './data';
import { nextShortId, updateSubDb, useSubSession } from './store';
import { Col, Grid, goTo, param, setFlash, useRefs } from './ui';
import { TroubleshootingSafety } from './equipamento-lib';
import { photoSrc } from './photos';
import './equipamento.css';

/** Estados: idle · required (salvar vazio) · warranty (garantia = Sim sem datas) · troubleshooting (seção 5 preenchida) */
const STATES = ['idle', 'required', 'warranty', 'troubleshooting'] as const;
type Mode = (typeof STATES)[number];

const NOTES_MAX = 500;
const tipId = () => `TIP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const cloneTs = (ts: TroubleshootingEntry[]): TroubleshootingEntry[] => ts.map((t) => ({ problemId: t.problemId, tips: t.tips.map((x) => ({ id: tipId(), text: x.text })) }));

interface Draft {
  name: string; categoryId: string; maker: string; model: string; serial: string; code: string;
  unitId: string; environmentId: string;
  statusId: string; criticalityId: string; acquiredAt: string; valueDigits: string;
  warranty: 'sim' | 'nao'; wStart: string; wEnd: string;
  photoName: string; labelPhotoName: string; notes: string;
  ts: TroubleshootingEntry[];
}

/** Campo de foto (ImageUpload do DS) com envio simulado: guarda só o nome do arquivo; a miniatura vale na sessão da tela. */
function PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (name: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const shownPreview = previewUrl ?? photoSrc(value);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const onFile = (file: File | null) => {
    if (!file) { setPreviewUrl(undefined); onChange(''); return; }
    setLoading(true);
    timer.current = window.setTimeout(() => { setPreviewUrl(URL.createObjectURL(file)); onChange(file.name); setLoading(false); }, 600);
  };
  return <ImageUpload label={label} optional fileName={value} previewUrl={shownPreview} loading={loading} onChange={onFile} />;
}

type Tip = { id: string; text: string };
const TIP_MAX_HEIGHT = 160; // px: a textarea cresce com o conteúdo até aqui, depois rola

/** Uma dica: cabeçalho (alça de arrastar + "Dica N"), textarea compacta com lixeira ao lado e Subir/Descer. */
function TipRow({ tip, index, total, problem, error, dragging, over, onText, onMove, onRemove, onDragStart, onDragEnd, onDragOver, onDrop }: {
  tip: Tip; index: number; total: number; problem: string; error?: string; dragging: boolean; over: boolean;
  onText: (v: string) => void; onMove: (delta: -1 | 1) => void; onRemove: () => void;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Auto-ajuste da altura: parte de ~2 linhas e cresce até um limite razoável
  useEffect(() => {
    const el = rowRef.current?.querySelector('textarea');
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TIP_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > TIP_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [tip.text]);
  return (
    <div
      ref={rowRef} data-tip={tip.id}
      className={`tip-row${dragging ? ' is-dragging' : ''}${over ? ' is-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }} onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      <Stack gap="xs">
        <div className="tip-head">
          <span
            className="tip-handle" role="img" aria-label={`Arrastar para reordenar a dica ${index + 1} de ${problem}`} title="Arrastar para reordenar"
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tip.id); if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 16, 16); onDragStart(); }}
            onDragEnd={onDragEnd}
          >
            <IconGripVertical size={16} aria-hidden="true" />
          </span>
          <span className="tip-title">{`Dica ${index + 1}`}</span>
        </div>
        <div className="tip-field">
          <Textarea
            aria-label={`Dica ${index + 1} de ${problem}`} rows={2} placeholder="Ex.: Verifique se o plugue está bem encaixado na tomada"
            value={tip.text} onChange={(e) => onText(e.target.value)} error={error}
          />
          <Tooltip content="Remover dica" placement="top">
            <Button variant="ghost" iconOnly className="tip-remove" iconLeft={<IconTrash size={16} />} aria-label="Remover dica" onClick={onRemove} />
          </Tooltip>
        </div>
        <Stack direction="horizontal" gap="xs" wrap>
          <Button variant="ghost" size="sm" iconLeft={<IconArrowUp size={16} />} disabled={index === 0} aria-label={`Subir dica ${index + 1} de ${problem}`} onClick={() => onMove(-1)}>Subir</Button>
          <Button variant="ghost" size="sm" iconLeft={<IconArrowDown size={16} />} disabled={index === total - 1} aria-label={`Descer dica ${index + 1} de ${problem}`} onClick={() => onMove(1)}>Descer</Button>
        </Stack>
      </Stack>
    </div>
  );
}

/** Dicas de um problema: ordenação por arrastar (desktop) e por Subir/Descer (alternativa acessível, também no toque). */
function TipsEditor({ problem, tips, tried, setTips }: {
  problem: string; tips: Tip[]; tried: boolean; setTips: (fn: (tips: Tip[]) => Tip[]) => void;
}) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusId) return;
    root.current?.querySelector<HTMLTextAreaElement>(`[data-tip="${focusId}"] textarea`)?.focus();
    setFocusId(null);
  }, [focusId, tips.length]);

  const reorder = (a: number, b: number) => setTips((all) => { const n = [...all]; const [it] = n.splice(a, 1); n.splice(b, 0, it); return n; });
  const move = (i: number, delta: -1 | 1) => reorder(i, i + delta);
  const endDrag = () => { setFrom(null); setOver(null); };

  return (
    <div ref={root}>
      <Stack gap="md">
        {tips.length === 0 && <p className="field-note">Nenhuma dica cadastrada para este problema.</p>}
        {tips.map((tip, i) => (
          <TipRow
            key={tip.id} tip={tip} index={i} total={tips.length} problem={problem}
            error={tried && !tip.text.trim() ? requiredMessage('Dica') : undefined}
            dragging={from === i} over={from !== null && over === i && from !== i}
            onText={(v) => setTips((all) => all.map((x) => (x.id === tip.id ? { ...x, text: v } : x)))}
            onMove={(delta) => move(i, delta)}
            onRemove={() => setTips((all) => all.filter((x) => x.id !== tip.id))}
            onDragStart={() => setFrom(i)} onDragEnd={endDrag} onDragOver={() => setOver(i)}
            onDrop={() => { if (from !== null && from !== i) reorder(from, i); endDrag(); }}
          />
        ))}
        <Stack direction="horizontal">
          <Button
            variant="secondary" size="sm" iconLeft={<IconPlus size={16} />}
            onClick={() => { const id = tipId(); setTips((all) => [...all, { id, text: '' }]); setFocusId(id); }}
          >Adicionar dica</Button>
        </Stack>
      </Stack>
    </div>
  );
}

function EquipamentoFormScreen() {
  const toast = useToast();
  const refs = useRefs();
  const { db, can, unitIds } = useSubSession();
  const editing = db.equipments.find((e) => e.id === param('id'));
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const eqStatuses = refs.activeStatuses('equipamento');

  const initial = (): Draft => {
    if (editing) {
      return {
        name: editing.name, categoryId: editing.categoryId, maker: editing.maker, model: editing.model, serial: editing.serial, code: editing.code,
        unitId: editing.unitId, environmentId: editing.environmentId, statusId: editing.statusId, criticalityId: editing.criticalityId,
        acquiredAt: editing.acquiredAt ?? '', valueDigits: editing.valueCents ? String(editing.valueCents) : '',
        warranty: editing.warranty.has ? 'sim' : 'nao', wStart: editing.warranty.start ?? '', wEnd: editing.warranty.end ?? '',
        photoName: editing.photoName ?? '', labelPhotoName: editing.labelPhotoName ?? '', notes: editing.notes ?? '', ts: cloneTs(editing.troubleshooting),
      };
    }
    const u = param('unit'); const unitId = u && unitIds.includes(u) ? u : '';
    const env = param('env'); const envOk = env && db.environments.some((x) => x.id === env && x.unitId === unitId);
    return {
      name: '', categoryId: '', maker: '', model: '', serial: '', code: '', unitId, environmentId: envOk ? env! : '',
      statusId: eqStatuses.find((s) => refs.base(s.id) === 'concluido')?.id ?? '', criticalityId: '', acquiredAt: '', valueDigits: '',
      warranty: 'nao', wStart: '', wEnd: '', photoName: '', labelPhotoName: '', notes: '', ts: [],
    };
  };
  const [d, setD] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [submitTick, setSubmitTick] = useState(0);
  const [copyFrom, setCopyFrom] = useState('');
  const intent = useRef<'save' | 'next'>('save');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // Variantes do navegador (só no cadastro): preenchem um exemplo e mostram o estado
  useEffect(() => {
    if (editing || mode === 'idle') return;
    const base = { name: 'Fritadeira 03', categoryId: refs.admin.categories.find((c) => c.name === 'Cocção')?.id ?? '', unitId: unitIds[0] ?? '', criticalityId: 'CRI-B', maker: 'Venâncio', model: 'FEA-20' };
    if (mode === 'warranty') setD((x) => ({ ...x, ...base, warranty: 'sim' }));
    if (mode === 'troubleshooting') {
      setD((x) => ({
        ...x, ...base, code: 'PAT-1840',
        ts: [
          { problemId: 'TSO-001', tips: ['Verifique se o plugue está bem encaixado na tomada', 'Confira se o disjuntor do equipamento não desarmou no quadro', 'Aguarde 10 minutos com o equipamento desligado e tente ligar novamente'].map((text) => ({ id: tipId(), text })) },
          { problemId: 'TSO-003', tips: [{ id: tipId(), text: 'Confirme se o termostato está no nível correto de temperatura' }] },
        ],
      }));
      return;
    }
    setTried(true);
    setSubmitTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const allowed = editing ? can('equipamentos', 'editar') : can('equipamentos', 'cadastrar');
  const scopeOk = !editing || unitIds.includes(editing.unitId);

  // ── Opções ──
  const units = db.units.filter((u) => unitIds.includes(u.id) && (u.status === 'ativo' || u.id === editing?.unitId)).map((u) => ({ value: u.id, label: u.name }));
  const envs = db.environments.filter((x) => x.unitId === d.unitId && (x.status === 'ativo' || x.id === editing?.environmentId)).map((x) => ({ value: x.id, label: x.name }));
  const categories = refs.admin.categories.filter((c) => c.status === 'ativo' || c.id === editing?.categoryId).map((c) => ({ value: c.id, label: c.name }));
  const statuses = eqStatuses.map((s) => ({ value: s.id, label: s.name }));
  if (editing && !statuses.some((s) => s.value === editing.statusId)) statuses.push({ value: editing.statusId, label: refs.status(editing.statusId)?.name ?? editing.statusId });
  const criticalities = refs.admin.criticalities.map((c) => ({ value: c.id, label: c.name }));
  const problemTypes = refs.admin.requestTypes.filter((t) => t.status === 'ativo' || d.ts.some((x) => x.problemId === t.id));

  // ── Validação (RF301-CTA001: nome, categoria, unidade, status e criticidade) ──
  const tipsOf = (problemId: string) => d.ts.find((t) => t.problemId === problemId)?.tips ?? [];
  const emptyTips = d.ts.flatMap((t) => t.tips).filter((t) => !t.text.trim()).map((t) => t.id);
  const problems = {
    name: !d.name.trim() ? requiredMessage('Nome do equipamento') : undefined,
    categoryId: !d.categoryId ? requiredMessage('Categoria') : undefined,
    unitId: !d.unitId ? requiredMessage('Unidade') : undefined,
    statusId: !d.statusId ? requiredMessage('Status') : undefined,
    criticalityId: !d.criticalityId ? requiredMessage('Criticidade') : undefined,
    wStart: d.warranty === 'sim' && !d.wStart ? requiredMessage('Início da garantia') : undefined,
    wEnd: d.warranty === 'sim' ? (!d.wEnd ? requiredMessage('Fim da garantia') : d.wStart && d.wEnd < d.wStart ? 'O fim da garantia não pode ser anterior ao início' : undefined) : undefined,
    tips: emptyTips.length ? requiredMessage('Dica') : undefined,
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);

  useEffect(() => {
    if (!submitTick) return;
    const messages = Object.values(problems).filter(Boolean) as string[];
    if (!messages.length) return;
    const empty = messages.filter((m) => /é obrigatório$/.test(m)).length;
    setBanner(messages.length === 1 ? null : empty === messages.length ? 'required' : 'multiple');
    const first = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTick]);

  // ── Troubleshooting por problema (RF301-RGN009 / RF403) ──
  const setTips = (problemId: string, fn: (tips: Array<{ id: string; text: string }>) => Array<{ id: string; text: string }>) => setD((x) => {
    const has = x.ts.some((t) => t.problemId === problemId);
    const ts = has ? x.ts.map((t) => (t.problemId === problemId ? { ...t, tips: fn(t.tips) } : t)) : [...x.ts, { problemId, tips: fn([]) }];
    return { ...x, ts };
  });

  // 💡 ZC001: copiar dicas de outro equipamento. Fabricante/Modelo são texto livre, então não servem de regra: a categoria só restringe
  // as opções (mesma categoria, com ao menos uma dica, diferente do atual); a decisão de copiar é do usuário.
  const copyCandidates = db.equipments.filter((e) => e.id !== editing?.id && unitIds.includes(e.unitId) && !!d.categoryId && e.categoryId === d.categoryId
    && e.troubleshooting.some((t) => t.tips.length > 0));
  const copyOptions = copyCandidates.map((e) => ({
    value: e.id, label: e.name, description: [e.maker, e.model].map((x) => x.trim()).concat(db.units.find((u) => u.id === e.unitId)?.name ?? '').filter(Boolean).join(' · ') || undefined,
    leading: <span className="eq-thumb"><IconPhoto aria-hidden="true" /></span>,
  }));
  const copySelected = copyOptions.some((o) => o.value === copyFrom) ? copyFrom : '';
  const doCopy = () => {
    const src = db.equipments.find((e) => e.id === copySelected);
    if (!src) return;
    setD((x) => ({ ...x, ts: cloneTs(src.troubleshooting) }));
    toast.show({ type: 'success', title: 'Troubleshooting copiado', message: `As dicas de ${src.name} foram copiadas. Revise antes de salvar.` });
    setCopyFrom('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setBanner(null);
    setSubmitTick((n) => n + 1);
    if (invalid) return;
    setSaving(true);
    const stopped = refs.visualOf(d.statusId) === 'critico';
    const valueCents = d.valueDigits ? Number(d.valueDigits) : undefined;
    const data = {
      name: d.name.trim(), categoryId: d.categoryId, maker: d.maker.trim(), model: d.model.trim(), serial: d.serial.trim(), code: d.code.trim(),
      unitId: d.unitId, environmentId: d.environmentId, statusId: d.statusId, criticalityId: d.criticalityId,
      acquiredAt: d.acquiredAt || undefined, valueCents: valueCents || undefined,
      warranty: d.warranty === 'sim' ? { has: true, start: d.wStart, end: d.wEnd } : { has: false },
      photoName: d.photoName || undefined, labelPhotoName: d.labelPhotoName || undefined, notes: d.notes.trim() || undefined,
      troubleshooting: d.ts.map((t) => ({ problemId: t.problemId, tips: t.tips.map((x) => ({ id: x.id, text: x.text.trim() })) })).filter((t) => t.tips.length > 0),
      // Downtime (RF304-RGN005): marca quando entra em "Parado" e zera quando sai
      stoppedSince: stopped ? (editing?.stoppedSince ?? hoursAgo(0)) : undefined,
    };
    let id = editing?.id ?? '';
    updateSubDb((db0) => {
      if (editing) return { ...db0, equipments: db0.equipments.map((x) => (x.id === editing.id ? { ...x, ...data } : x)) };
      id = nextShortId('EQP', db0.equipments.map((x) => x.id));
      // Todo equipamento nasce com QR Code único e não sequencial (RF305-RGN001/RGN004) e data de cadastro (RF301-FLU004)
      const created: Equipment = { id, ...data, createdAt: nowLocal(), qrToken: `q${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}` };
      return { ...db0, equipments: [...db0.equipments, created] };
    });
    if (editing) setFlash({ type: 'success', title: 'Equipamento atualizado', message: 'As alterações foram salvas.' });
    else setFlash({ type: 'success', title: 'Equipamento cadastrado', message: intent.current === 'next' ? 'O QR Code foi gerado. Preencha o próximo, que já vem com a mesma unidade e o mesmo ambiente.' : 'O QR Code do equipamento foi gerado e já pode ser impresso.' });
    window.setTimeout(() => goTo(!editing && intent.current === 'next'
      ? `equipamento-form.html?unit=${d.unitId}${d.environmentId ? `&env=${d.environmentId}` : ''}`
      : `equipamento.html?id=${id}`), 400);
  };

  const title = editing ? `Editar ${editing.name}` : 'Novo equipamento';
  const layout = (children: React.ReactNode) => <AppLayout active="equipamentos" screen="equipamentos">{children}</AppLayout>;

  if (param('id') && !editing) return layout(<Feedback type="error" title="Equipamento não encontrado" message="Volte para a listagem e tente novamente" />);
  if (!allowed || !scopeOk) {
    return layout(
      <Feedback type="warning" title="Você não tem permissão para esta ação" message="Seu perfil só consulta equipamentos. Fale com um administrador da sua empresa para cadastrar ou editar" />,
    );
  }

  return layout(
    <form className="form-page" onSubmit={onSubmit} onChangeCapture={() => setBanner(null)} noValidate>
      <Stack gap="xl">
        <PageHeader
          title={title}
          subtitle={editing ? undefined : 'O QR Code do equipamento é gerado automaticamente ao salvar'}
          breadcrumb={[{ label: 'Equipamentos', href: 'equipamentos.html' }, { label: editing ? 'Editar' : 'Novo equipamento' }]}
        />
        {banner && (
          <div className="floating-feedback">
            {banner === 'required'
              ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={() => setBanner(null)} />
              : <Feedback type="error" title="Não foi possível salvar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={() => setBanner(null)} />}
          </div>
        )}

        <DevNote note="RF301-CTA001: só nome, categoria, unidade, status e criticidade são obrigatórios; os demais campos são opcionais (marcados com “(opcional)”). Equipamento é identificado também pelo código/patrimônio, para localizar sem QR Code (RGN002).">
          <Card className="card-open" title="1. Identificação" subtitle="Como o equipamento é conhecido na operação">
            <div className="card-body-tight">
              <Grid>
                <Col span={8}><Input label="Nome do equipamento" required autoComplete="off" placeholder="Ex.: Freezer vertical 21" value={d.name} onChange={(e) => set('name', e.target.value)} error={show('name')} /></Col>
                <Col span={4}><Dropdown label="Categoria" required options={categories} value={d.categoryId} onChange={(v) => set('categoryId', v)} error={show('categoryId')} /></Col>
                <Col span={6}><Input label="Fabricante" optional autoComplete="off" value={d.maker} onChange={(e) => set('maker', e.target.value)} /></Col>
                <Col span={6}><Input label="Modelo" optional autoComplete="off" value={d.model} onChange={(e) => set('model', e.target.value)} /></Col>
                <Col span={6}><Input label="Número de série" optional autoComplete="off" value={d.serial} onChange={(e) => set('serial', e.target.value)} /></Col>
                <Col span={6}><Input label="Código interno / patrimônio" optional autoComplete="off" value={d.code} onChange={(e) => set('code', e.target.value)} helperText="Usado para localizar o equipamento sem QR Code" /></Col>
              </Grid>
            </div>
          </Card>
        </DevNote>

        <Card className="card-open" title="2. Localização" subtitle="Onde o equipamento está instalado">
          <div className="card-body-tight">
            <Grid>
              <Col span={6}>
                <Dropdown label="Unidade" required options={units} value={d.unitId} onChange={(v) => setD((x) => ({ ...x, unitId: v, environmentId: db.environments.some((e) => e.id === x.environmentId && e.unitId === v) ? x.environmentId : '' }))} error={show('unitId')} />
              </Col>
              <Col span={6}>
                <DevNote note="Ambiente filtrado pela unidade escolhida (RF301); recomendado, mas opcional.">
                  <Dropdown label="Ambiente" optional options={envs} value={d.environmentId} onChange={(v) => set('environmentId', v)} disabled={!d.unitId} placeholder={d.unitId ? 'Selecione' : 'Escolha a unidade primeiro'} />
                </DevNote>
              </Col>
            </Grid>
          </div>
        </Card>

        <Card className="card-open" title="3. Ciclo de vida" subtitle="Situação, importância e garantia do equipamento">
          <div className="card-body-tight">
            <Grid>
              <Col span={6}>
                <DevNote note="Status vindos de Configurações (Admin RF407, módulo Equipamento). Ao salvar com status do tipo Parado, o downtime começa a contar (RF304-RGN005); ao sair dele, volta a zero.">
                  <Dropdown label="Status" required options={statuses} value={d.statusId} onChange={(v) => set('statusId', v)} error={show('statusId')} />
                </DevNote>
              </Col>
              <Col span={6}><Dropdown label="Criticidade" required options={criticalities} value={d.criticalityId} onChange={(v) => set('criticalityId', v)} error={show('criticalityId')} /></Col>
              <Col span={6}><DatePicker label="Data de instalação" optional value={d.acquiredAt} onChange={(v) => set('acquiredAt', v)} max={dayOnly(0)} /></Col>
              <Col span={6}>
                <DevNote note="Valor de aquisição é opcional (decisão de 29/09): é usado para comparar o custo de manutenção com o valor do ativo. Sem valor, a relação manutenção/ativo fica zerada no detalhe (RF304-RGN004 / CTA004).">
                  <Input
                    label="Valor de aquisição" optional inputMode="numeric" autoComplete="off" placeholder="R$ 0,00"
                    value={d.valueDigits ? formatMoney(Number(d.valueDigits)) : ''} onChange={(e) => set('valueDigits', onlyDigits(e.target.value).replace(/^0+/, '').slice(0, 10))}
                    helperText="Usado para comparar o custo de manutenção com o valor do ativo"
                  />
                </DevNote>
              </Col>
              <Col span={12}>
                <DevNote note="RF301-RGN003: garantia ativa = data atual entre início e fim. Com “Em garantia = Sim”, início e fim passam a ser obrigatórios.">
                  <RadioButton name="warranty" label="Em garantia?" orientation="horizontal" options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]} value={d.warranty} onChange={(v) => set('warranty', v as 'sim' | 'nao')} />
                </DevNote>
              </Col>
              {d.warranty === 'sim' && (
                <>
                  <Col span={6}><DatePicker label="Início da garantia" required value={d.wStart} onChange={(v) => set('wStart', v)} error={show('wStart')} /></Col>
                  <Col span={6}><DatePicker label="Fim da garantia" required value={d.wEnd} onChange={(v) => set('wEnd', v)} min={d.wStart || undefined} error={show('wEnd')} /></Col>
                </>
              )}
            </Grid>
          </div>
        </Card>

        <DevNote note="Upload simulado no protótipo: só o nome do arquivo é guardado. Formatos JPG e PNG; 💡 limite de tamanho a definir (RF301). Observações até 500 caracteres.">
          <Card className="card-open" title="4. Fotos e observações" subtitle="Adicione fotos e informações complementares sobre o equipamento">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><PhotoField label="Foto do equipamento" value={d.photoName} onChange={(v) => set('photoName', v)} /></Col>
                <Col span={6}><PhotoField label="Foto da etiqueta ou placa" value={d.labelPhotoName} onChange={(v) => set('labelPhotoName', v)} /></Col>
                <Col span={12}>
                  <Textarea
                    label="Observações" optional rows={4} maxLength={NOTES_MAX} value={d.notes} onChange={(e) => set('notes', e.target.value)}
                    helperText={`${d.notes.length}/${NOTES_MAX} caracteres`}
                  />
                </Col>
              </Grid>
            </div>
          </Card>
        </DevNote>

        <DevNote note="RF301-RGN006 / RGN009 (v0.4): troubleshooting é opcional e cadastrado por problema (tipo de solicitação, Admin RF403), com dicas da mais simples à mais complexa. Só quem tem permissão “Editar” em Equipamentos chega a esta tela - Solicitante e Executor nunca cadastram, por envolver segurança (eletricidade, gás). Sem arrastar: reordene com Subir/Descer. 💡 Imagem opcional por dica fica para depois.">
          <Card className="card-open" title={<>5. Troubleshooting <span className="title-optional">(opcional)</span></>} subtitle="Dicas para o solicitante tentar resolver o problema antes de abrir uma solicitação">
            <div className="card-body-tight">
              <Stack gap="lg">
                <TroubleshootingSafety />
                <DevNote note="💡 ZC001 / RGN007: Fabricante e Modelo são texto livre, então não definem compatibilidade. A categoria só filtra as opções (mesma categoria, com dicas, outro equipamento); busca por nome, fabricante e modelo. Copiar substitui as dicas atuais e dá para revisar antes de salvar; escolher na lista não copia sozinho. 💡 Miniatura: o protótipo guarda só o nome da foto, então usa o placeholder.">
                  <Stack gap="xs">
                    <div className="copy-row">
                      <Dropdown
                        label="Copiar dicas de outro equipamento" optional searchable searchPlaceholder="Buscar por nome, fabricante ou modelo" emptyText="Nenhum equipamento encontrado"
                        options={copyOptions} value={copySelected} onChange={setCopyFrom}
                        placeholder={copyOptions.length ? 'Selecione um equipamento' : d.categoryId ? 'Nenhum outro equipamento desta categoria possui dicas cadastradas' : 'Escolha a categoria do equipamento primeiro'}
                        disabled={!copyOptions.length}
                      />
                      {copyOptions.length > 0 && <Button variant="secondary" iconLeft={<IconCopy size={20} />} disabled={!copySelected} onClick={doCopy}>Copiar dicas</Button>}
                    </div>
                    <p className="field-note">Mostra equipamentos da mesma categoria que possuem dicas cadastradas</p>
                    {copyOptions.length > 0 && <p className="field-note">Substitui as dicas atuais pelas do equipamento escolhido</p>}
                  </Stack>
                </DevNote>
                <Accordion
                  allowMultiple headingLevel={3}
                  defaultOpenIndex={mode === 'troubleshooting' ? [0, 2] : problemTypes.map((t, i) => (tipsOf(t.id).length ? i : -1)).filter((i) => i >= 0)}
                  items={problemTypes.map((t) => {
                    const tips = tipsOf(t.id);
                    return {
                      title: t.name,
                      meta: tips.length === 0 ? 'Nenhuma dica' : `${tips.length} ${tips.length === 1 ? 'dica' : 'dicas'}`,
                      content: <TipsEditor problem={t.name} tips={tips} tried={tried} setTips={(fn) => setTips(t.id, fn)} />,
                    };
                  })}
                />
              </Stack>
            </div>
          </Card>
        </DevNote>

        <Stack direction="horizontal" justify="start" gap="sm" wrap>
          <Button type="submit" disabled={saving} onClick={() => { intent.current = 'save'; }}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar'}</Button>
          {!editing && (
            <DevNote note="RF301-FLU003 / CTA003: salva e abre um novo formulário mantendo unidade e ambiente, para agilizar o mapeamento de uma cozinha.">
              <Button type="submit" variant="secondary" disabled={saving} onClick={() => { intent.current = 'next'; }}>Salvar e cadastrar próximo</Button>
            </DevNote>
          )}
          <Button variant="secondary" disabled={saving} onClick={() => goTo(editing ? `equipamento.html?id=${editing.id}` : 'equipamentos.html')}>Cancelar</Button>
        </Stack>
      </Stack>
    </form>,
  );
}

mountApp(<EquipamentoFormScreen />);
