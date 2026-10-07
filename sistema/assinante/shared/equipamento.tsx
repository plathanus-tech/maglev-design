import { useEffect, useMemo, useState } from 'react';
import {
  IconBuildingStore, IconCircleCheck, IconCircleOff, IconClockPause, IconLayoutGrid, IconClipboardList, IconCopy, IconPencil, IconPhoto, IconPrinter, IconQrcode, IconReportMoney, IconTool, IconCalendarEvent,
} from '@tabler/icons-react';
import { Accordion, Badge, Button, Card, Dialog, EmptyState, Feedback, KpiCard, Stack, Tab, TableColumn, useToast } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { formatDate, formatDateTime, formatMoney } from '../../admin/shared/format';
import { RECURRENCE_DAYS, dayOnly, qrLink } from './data';
import { unitName, environmentName, useSubSession } from './store';
import { Col, Grid, ReadField, goTo, param, takeFlash, useRefs } from './ui';
import {
  AttentionPoint, AttentionPoints, EquipmentToggleDialog, QrDialogs, SimpleList, downtimeText, executorName, frequencyText, isInactive, isOverdue, isStopped, nextPreventive, openOrdersOf, realizedCents, recurrenceOf, spentOf, useCopy,
} from './equipamento-lib';
import { RowMenu, RowMenuItem } from './RowMenu';
import { photoSrc } from './photos';
import { MobileCardItem } from '../../admin/shared/MobileCardList';
import './equipamento.css';

/** Estados: idle · qr (abre o Dialog do QR Code) */
/** idle: mostra todos os pontos de atenção (1 = alerta individual, 2+ = agrupados) · stopped / recurrence: filtros de protótipo para ver só um motivo */
const STATES = ['idle', 'qr', 'stopped', 'recurrence'] as const;
type Mode = (typeof STATES)[number];

type Row = Record<string, unknown> & { id: string };
const link = (href: string, text: string) => <a className="text-link" href={href}>{text}</a>;
const EXEC_STATUS = { pendente: { label: 'Pendente', badge: 'info' }, concluida: { label: 'Concluída', badge: 'success' }, 'nao-realizada': { label: 'Não realizada', badge: 'error' } } as const;

function EquipamentoScreen() {
  const toast = useToast();
  const refs = useRefs();
  const copy = useCopy();
  const { db, can, unitIds, canSeeCosts } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const eq = db.equipments.find((e) => e.id === param('id'));
  const [qr, setQr] = useState<'qr' | 'label' | null>(null);
  const [toggling, setToggling] = useState(false);
  const [zoom, setZoom] = useState<{ title: string; name: string } | null>(null);

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === 'qr') setQr('qr'); }, [mode]);

  const data = useMemo(() => {
    if (!eq) return null;
    const orders = db.orders.filter((o) => o.equipmentId === eq.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const requests = db.requests.filter((r) => r.equipmentId === eq.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    const plans = db.plans.filter((p) => p.equipmentIds.includes(eq.id));
    const executions = db.executions.filter((x) => x.equipmentId === eq.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    const history = [
      ...orders.filter((o) => refs.base(o.statusId) === 'concluido').map((o) => ({
        id: o.id, at: (o.activities[o.activities.length - 1]?.at ?? o.createdAt), kind: o.kind, text: o.subject,
        provider: executorName(db, o.executor), cents: realizedCents(refs, o), photos: o.files.filter((f) => f.kind === 'foto').map((f) => f.name), href: `os.html?id=${o.id}`,
      })),
      ...executions.filter((x) => x.status === 'concluida' && !x.osId).map((x) => ({
        id: x.id, at: x.doneAt ?? `${x.dueDate}T09:00:00`, kind: 'preventiva' as const, text: db.plans.find((p) => p.id === x.planId)?.name ?? 'Preventiva',
        provider: x.doneBy ?? '-', cents: 0, photos: [] as string[], href: `plano.html?id=${x.planId}`,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return { orders, requests, plans, executions, history, open: openOrdersOf(db, refs, eq.id), spent: spentOf(db, refs, eq.id), next: nextPreventive(db, eq.id) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, refs.admin, eq]);

  if (!eq || !data) {
    return <AppLayout active="equipamentos" screen="equipamentos"><Feedback type="error" title="Equipamento não encontrado" message="Volte para a listagem e tente novamente" /></AppLayout>;
  }
  if (!unitIds.includes(eq.unitId)) {
    return <AppLayout active="equipamentos" screen="equipamentos"><Feedback type="warning" title="Você não tem acesso a este equipamento" message="Ele pertence a uma unidade que não está vinculada ao seu perfil" /></AppLayout>;
  }

  const inactive = isInactive(refs, eq);
  const stopped = isStopped(refs, eq);
  const recurrence = recurrenceOf(db, refs, eq.id);
  const attention: AttentionPoint[] = [];
  if (stopped && !inactive && mode !== 'recurrence') attention.push({ id: 'stopped', severity: 'warning', title: 'Equipamento parado', message: `Parado desde ${eq.stoppedSince ? formatDateTime(eq.stoppedSince) : 'data não registrada'}. Acompanhe as OS abertas na aba Ordens de serviço` });
  if (!inactive && recurrence.alert && mode !== 'stopped') attention.push({ id: 'recurrence', severity: 'warning', title: 'Falhas recorrentes neste equipamento', message: `${recurrence.count} corretivas nos últimos ${RECURRENCE_DAYS} dias. Avalie a causa raiz ou considere a substituição do equipamento` });
  if (!stopped && !inactive && refs.visualOf(eq.statusId) === 'atencao' && mode === 'idle') attention.push({ id: 'alert', severity: 'warning', title: 'Equipamento com alerta ou falha', message: 'Há um problema registrado, mas ele ainda opera' });
  const canEdit = can('equipamentos', 'editar');
  const canRequest = can('solicitacoes', 'cadastrar') && !inactive;
  const url = qrLink(eq);
  // Ação principal: Solicitar manutenção (ativo); Ativar (inativo, com permissão); senão Editar. O menu ⋮ leva o resto
  const canToggle = can('equipamentos', 'ativar');
  const primary: 'request' | 'activate' | 'edit' | null = canRequest ? 'request' : inactive && canToggle ? 'activate' : canEdit ? 'edit' : null;
  const moreActions: RowMenuItem[] = [
    ...(canEdit && primary !== 'edit' ? [{ label: 'Editar equipamento', icon: <IconPencil size={16} />, onClick: () => goTo(`equipamento-form.html?id=${eq.id}`) }] : []),
    { label: 'Imprimir etiqueta', icon: <IconPrinter size={16} />, onClick: () => setQr('label') },
    { label: 'Copiar link de solicitação', icon: <IconCopy size={16} />, onClick: () => copy(url) },
    ...(canToggle && !inactive ? [{ label: 'Inativar', icon: <IconCircleOff size={16} />, onClick: () => setToggling(true) }] : []),
  ];
  const today = dayOnly(0);
  const w = eq.warranty;
  const warrantyBadge = !w.has ? <Badge status="neutral" dot>Sem garantia</Badge>
    : w.end && w.end < today ? <Badge status="warning" dot>Garantia expirada</Badge>
    : w.start && w.start > today ? <Badge status="neutral" dot>Garantia ainda não iniciada</Badge>
    : <Badge status="success" dot>Em garantia</Badge>;
  const ratio = eq.valueCents ? (data.spent / eq.valueCents) * 100 : 0;
  const category = refs.category(eq.categoryId)?.name;
  const place = [unitName(db, eq.unitId), eq.environmentId ? environmentName(db, eq.environmentId) : ''].filter(Boolean).join(' · ');

  // ── Abas ──
  /** Miniatura compacta da foto: abre a imagem ampliada (sem editar). O protótipo guarda só o nome do arquivo; fotos conhecidas resolvem para a imagem. */
  const photoThumb = (title: string, name?: string) => (
    <div className="eq-photo">
      <span className="read-label">{title}</span>
      {name ? (
        <button type="button" className="eq-photo-tile" onClick={() => setZoom({ title, name })} aria-label={`Ampliar ${title.toLowerCase()} (${name})`}>
          {photoSrc(name) ? <img src={photoSrc(name)} alt="" /> : (<><IconPhoto size={20} aria-hidden="true" /><span className="eq-photo-name">{name}</span></>)}
        </button>
      ) : (
        <div className="eq-photo-tile is-empty" role="img" aria-label={`${title}: sem foto`}>
          <IconPhoto size={20} aria-hidden="true" />
          <span className="eq-photo-name">Sem foto</span>
        </div>
      )}
    </div>
  );

  const timeline = (
    <Card title="Histórico de manutenções" subtitle="Manutenções concluídas, da mais recente para a mais antiga">
      {data.history.length === 0 ? <EmptyState title="Nenhuma manutenção concluída" description="As OS e preventivas concluídas aparecem aqui automaticamente" headingLevel={3} /> : (
        <ol className="eq-timeline">
          {data.history.map((h) => (
            <li key={h.id} className={`eq-timeline-item ${h.kind === 'corretiva' ? 'is-warning' : 'is-info'}`}>
              <Stack gap="xs">
                <Stack direction="horizontal" align="center" gap="sm" wrap>
                  <span className="page-label">{formatDate(h.at)}</span>
                  <Badge status={h.kind === 'corretiva' ? 'warning' : 'info'} dot>{h.kind === 'corretiva' ? 'Corretiva' : 'Preventiva'}</Badge>
                </Stack>
                {link(h.href, h.text)}
                <span className="cell-secondary">
                  {`Prestador: ${h.provider}`}{canSeeCosts && h.cents > 0 ? ` · Custo: ${formatMoney(h.cents)}` : ''}
                </span>
                {h.photos.length > 0 && (
                  <DevNote note="RF304: fotos opcionais registradas pela pessoa responsável durante a manutenção (OS ou execução preventiva); não vêm da Foto do equipamento do cadastro. Sem fotos, o item não mostra nada. Clique/toque amplia a imagem.">
                    <ul className="eq-hist-photos" aria-label="Fotos da manutenção">
                      {h.photos.map((name, i) => (
                        <li key={name + i}>
                          <button type="button" className="eq-photo-tile eq-hist-thumb" onClick={() => setZoom({ title: 'Foto da manutenção', name })} aria-label={`Ampliar foto ${i + 1} de ${h.photos.length} da manutenção de ${formatDate(h.at)} (${name})`}>
                            {photoSrc(name) ? <img src={photoSrc(name)} alt="" /> : <IconPhoto size={20} aria-hidden="true" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </DevNote>
                )}
              </Stack>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );

  const info = (
    <Stack gap="lg">
      <Card title="Identificação" subtitle="Dados de identificação e cadastro do equipamento">
        <div className="card-body-tight eq-ident-wrap">
          <div className="eq-ident">
            <Grid>
              <Col span={6}><ReadField label="Nome do equipamento" value={eq.name} /></Col>
              <Col span={6}><ReadField label="Categoria" value={category} /></Col>
              <Col span={6}><ReadField label="Fabricante" value={eq.maker} /></Col>
              <Col span={6}><ReadField label="Modelo" value={eq.model} /></Col>
              <Col span={6}><ReadField label="Número de série" value={eq.serial} /></Col>
              <Col span={6}><ReadField label="Código interno / patrimônio" value={eq.code} /></Col>
              <Col span={6}><ReadField label="Cadastrado em" value={formatDate(eq.createdAt)} /></Col>
              {eq.notes && <Col span={12}><ReadField label="Observações" value={eq.notes} /></Col>}
            </Grid>
            <div className="eq-photos-row">
              {photoThumb('Foto do equipamento', eq.photoName)}
              {photoThumb('Foto da etiqueta ou placa', eq.labelPhotoName)}
            </div>
          </div>
        </div>
      </Card>

         <Card title="Ciclo de vida e garantia" subtitle="Situação atual, aquisição e garantia do equipamento">
           <div className="card-body-tight">
             <Grid>
               <Col span={6}><ReadField label="Status" value={refs.statusBadge(eq.statusId)} /></Col>
               <Col span={6}><ReadField label="Criticidade" value={refs.criticalityBadge(eq.criticalityId)} /></Col>
               <Col span={6}><ReadField label="Data de instalação" value={eq.acquiredAt ? formatDate(eq.acquiredAt) : undefined} /></Col>
               {canSeeCosts && <Col span={6}><ReadField label="Valor de aquisição" value={eq.valueCents ? formatMoney(eq.valueCents) : undefined} /></Col>}
               <Col span={w.has ? 4 : 12}><ReadField label="Garantia" value={warrantyBadge} /></Col>
               {w.has && <Col span={4}><ReadField label="Início da garantia" value={w.start ? formatDate(w.start) : undefined} /></Col>}
               {w.has && <Col span={4}><ReadField label="Fim da garantia" value={w.end ? formatDate(w.end) : undefined} /></Col>}
             </Grid>
           </div>
         </Card>

      {timeline}
    </Stack>
  );

  const requestCols: TableColumn<Row>[] = [
    { key: 'id', label: 'Protocolo', render: (v) => link(`solicitacao.html?id=${v}`, String(v)) },
    { key: 'problem', label: 'Problema' },
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'openedAt', label: 'Abertura', render: (v) => formatDateTime(String(v)) },
    { key: 'requester', label: 'Solicitante' },
  ];
  const requestRows: Row[] = data.requests.map((r) => ({ id: r.id, problem: refs.requestType(r.problemId)?.name ?? '-', statusId: r.statusId, openedAt: r.openedAt, requester: r.requesterName }));
  const requestItem = (r: Row): MobileCardItem => ({
    id: r.id, title: link(`solicitacao.html?id=${r.id}`, r.id), subtitle: String(r.problem), badge: refs.statusBadge(String(r.statusId)),
    fields: [{ label: 'Abertura', value: formatDateTime(String(r.openedAt)) }, { label: 'Solicitante', value: String(r.requester) }],
  });

  const orderCols: TableColumn<Row>[] = [
    { key: 'id', label: 'OS', render: (v) => link(`os.html?id=${v}`, String(v)) },
    { key: 'subject', label: 'Assunto' },
    { key: 'kind', label: 'Tipo', render: (v) => (v === 'corretiva' ? 'Corretiva' : 'Preventiva') },
    { key: 'statusId', label: 'Status', render: (v) => refs.statusBadge(String(v)) },
    { key: 'priorityId', label: 'Prioridade', render: (v) => refs.priorityBadge(String(v)) },
    { key: 'dueAt', label: 'Prazo', render: (v) => formatDate(String(v)) },
    { key: 'executor', label: 'Responsável' },
    ...(canSeeCosts ? [{ key: 'cost', label: 'Custo', align: 'right' as const, render: (v: unknown) => formatMoney(Number(v)) }] : []),
  ];
  const orderRows: Row[] = data.orders.map((o) => ({ id: o.id, subject: o.subject, kind: o.kind, statusId: o.statusId, priorityId: o.priorityId, dueAt: o.dueAt, executor: executorName(db, o.executor), cost: realizedCents(refs, o) }));
  const orderItem = (r: Row): MobileCardItem => ({
    id: r.id, title: link(`os.html?id=${r.id}`, r.id), subtitle: String(r.subject), badge: refs.statusBadge(String(r.statusId)),
    fields: [
      { label: 'Tipo', value: r.kind === 'corretiva' ? 'Corretiva' : 'Preventiva' }, { label: 'Prioridade', value: refs.priorityBadge(String(r.priorityId)) },
      { label: 'Prazo', value: formatDate(String(r.dueAt)) }, { label: 'Responsável', value: String(r.executor) },
      ...(canSeeCosts ? [{ label: 'Custo', value: formatMoney(Number(r.cost)) }] : []),
    ],
  });

  const planCols: TableColumn<Row>[] = [
    { key: 'name', label: 'Plano', render: (v, r) => link(`plano.html?id=${r.id}`, String(v)) },
    { key: 'freq', label: 'Frequência' },
    { key: 'next', label: 'Próxima execução', render: (v) => (v ? <span className={isOverdue(String(v)) ? 'eq-overdue' : undefined}>{formatDate(String(v))}</span> : '-') },
    { key: 'executor', label: 'Responsável' },
  ];
  // Só planos ativos: o histórico de execuções independe da situação atual do plano
  const activePlans = data.plans.filter((p) => p.status === 'ativo');
  const planRows: Row[] = activePlans.map((p) => ({
    id: p.id, name: p.name, freq: frequencyText(p), executor: executorName(db, p.executor),
    next: data.executions.filter((x) => x.planId === p.id && x.status === 'pendente').map((x) => x.dueDate).sort()[0],
  }));
  const planItem = (r: Row): MobileCardItem => ({
    id: r.id, title: link(`plano.html?id=${r.id}`, String(r.name)),
    fields: [{ label: 'Frequência', value: String(r.freq) }, { label: 'Próxima execução', value: r.next ? formatDate(String(r.next)) : '-' }, { label: 'Responsável', value: String(r.executor) }],
  });
  const execCols: TableColumn<Row>[] = [
    { key: 'dueDate', label: 'Data prevista', render: (v) => formatDate(String(v)) },
    { key: 'plan', label: 'Plano', render: (v, r) => link(`plano.html?id=${r.planId}`, String(v)) },
    { key: 'status', label: 'Situação', render: (v) => { const s = EXEC_STATUS[v as keyof typeof EXEC_STATUS]; return <Badge status={s.badge} dot>{s.label}</Badge>; } },
    { key: 'by', label: 'Executada por' },
    { key: 'osId', label: 'OS', render: (v) => (v ? link(`os.html?id=${v}`, String(v)) : '-') },
  ];
  const execRows: Row[] = data.executions.map((x) => ({ id: x.id, planId: x.planId, plan: db.plans.find((p) => p.id === x.planId)?.name ?? '-', dueDate: x.dueDate, status: x.status, by: x.doneBy ?? '-', osId: x.osId }));
  const execItem = (r: Row): MobileCardItem => {
    const s = EXEC_STATUS[r.status as keyof typeof EXEC_STATUS];
    return { id: r.id, title: formatDate(String(r.dueDate)), subtitle: String(r.plan), badge: <Badge status={s.badge} dot>{s.label}</Badge>, fields: [{ label: 'Executada por', value: String(r.by) }, { label: 'OS', value: r.osId ? link(`os.html?id=${r.osId}`, String(r.osId)) : '-' }] };
  };

  const troubleshooting = eq.troubleshooting.length === 0 ? (
    <Card>
      <EmptyState
        title="Nenhum troubleshooting cadastrado" description="Sem dicas, o solicitante abre a solicitação direto" headingLevel={3}
        action={canEdit ? <Button variant="secondary" size="sm" iconLeft={<IconPencil size={16} />} onClick={() => goTo(`equipamento-form.html?id=${eq.id}`)}>Cadastrar dicas</Button> : undefined}
      />
    </Card>
  ) : (
    <Card title="Troubleshooting" subtitle="Dicas por problema, das mais simples às mais complexas">
      <Accordion
        allowMultiple headingLevel={3} defaultOpenIndex={[0]}
        items={eq.troubleshooting.map((t) => ({
          title: refs.requestType(t.problemId)?.name ?? t.problemId,
          meta: `${t.tips.length} ${t.tips.length === 1 ? 'dica' : 'dicas'}`,
          content: <Stack as="ol" gap="sm" className="ts-list">{t.tips.map((tip, i) => <li key={tip.id} className="ts-item page-text"><strong>Dica {i + 1}</strong> · {tip.text}</li>)}</Stack>,
        }))}
      />
    </Card>
  );

  return (
    <AppLayout active="equipamentos" screen="equipamentos">
      <Stack gap="xl">
        <PageHeader
          title={eq.name}
          badge={<Stack direction="horizontal" align="center" gap="xs" wrap>{refs.statusBadge(eq.statusId)}{refs.criticalityBadge(eq.criticalityId)}</Stack>}
          subtitle={`${eq.code || eq.id} · ${place}`}
          breadcrumb={[{ label: 'Equipamentos', href: 'equipamentos.html' }, { label: eq.name }]}
          actions={(
            <>
              {canRequest ? (
                <DevNote note="RF304-FLU003 → RF404: abre a solicitação já com este equipamento selecionado. Ação principal da página; não aparece para equipamento inativo.">
                  <Button iconLeft={<IconTool size={20} />} onClick={() => goTo(`solicitacao-form.html?equipment=${eq.id}`)}>Solicitar manutenção</Button>
                </DevNote>
              ) : primary === 'activate' ? (
                <DevNote note="Equipamento inativo: Ativar vira a ação principal da página (RF301-RGN004, com permissão “Ativar”) e Editar passa para o menu ⋮. Abre a confirmação antes de ativar.">
                  <Button iconLeft={<IconCircleCheck size={20} />} onClick={() => setToggling(true)}>Ativar equipamento</Button>
                </DevNote>
              ) : primary === 'edit' && <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`equipamento-form.html?id=${eq.id}`)}>Editar</Button>}
              <DevNote note="Ações secundárias no menu ⋮: Editar equipamento (com permissão), Imprimir etiqueta (RF305-FLU003/FLU005: prévia com QR + nome + código + logo; 💡 impressão em lote fica como sugestão), Copiar link de solicitação (RF305-FLU006: o mesmo link do QR Code, CTA003) e Ativar/Inativar (RF301-RGN004, com permissão “Ativar”). O QR Code continua existindo no equipamento e aparece na etiqueta; não há card fixo dele nesta página (o código QR não é exibido no cabeçalho).">
                <RowMenu variant="secondary" size="md" target={eq.name} label="Mais ações do equipamento" items={moreActions} />
              </DevNote>
            </>
          )}
        />

        {inactive && <Feedback type="warning" title="Equipamento inativo" message="Ele não aceita novas solicitações. O histórico, o QR Code e os custos continuam disponíveis para consulta" />}

        <DevNote note="RF304: indicadores calculados dos registros do equipamento (CTA002). Downtime atual = tempo desde que entrou em status do tipo Parado até agora, zerado quando volta a operar (RGN005). Gasto com manutenção = custos realizados das OS (sem orçamento ainda não aprovado). Gasto só para Administrador e Gestor (RGN003 - 💡 a confirmar).">
          <div className="eq-kpis">
            <KpiCard label="OS abertas" value={data.open.length} icon={<IconClipboardList size={20} />} href={`ordens-servico.html?equipment=${eq.id}`} />
            {canSeeCosts && <KpiCard label="Gasto com manutenção" value={formatMoney(data.spent)} description="Acumulado nas OS" icon={<IconReportMoney size={20} />} />}
            <KpiCard
              tone={isOverdue(data.next) ? 'error' : undefined} label="Próxima preventiva" value={data.next ? formatDate(data.next) : '-'} description={isOverdue(data.next) ? 'Vencida' : data.next ? 'Prevista' : 'Nenhuma agendada'}
              icon={<IconCalendarEvent size={20} />}
            />
            <KpiCard label="Downtime atual" value={stopped ? downtimeText(eq.stoppedSince) : '0 h'} description={stopped ? 'Parado desde ' + (eq.stoppedSince ? formatDateTime(eq.stoppedSince) : '-') : 'Em operação'} icon={<IconClockPause size={20} />} />
          </div>
        </DevNote>

        <Grid>
        <Col span={canSeeCosts ? 4 : 12} fill>
          <Card title="Localização" subtitle="Unidade e ambiente onde o equipamento está instalado">
            <div className="card-body-tight">
              <div className="eq-loc">
                <div className="eq-loc-item">
                  <span className="tree-lead" aria-hidden="true"><IconBuildingStore size={20} /></span>
                  <div className="eq-loc-text"><strong className="eq-loc-name">{unitName(db, eq.unitId)}</strong><span className="cell-secondary">Unidade</span></div>
                </div>
                {eq.environmentId && (
                  <>
                    <span className="eq-loc-link" aria-hidden="true" />
                    <div className="eq-loc-item">
                      <span className="tree-lead" aria-hidden="true"><IconLayoutGrid size={20} /></span>
                      <div className="eq-loc-text"><strong className="eq-loc-name">{environmentName(db, eq.environmentId)}</strong><span className="cell-secondary">Ambiente</span></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </Col>
        {canSeeCosts && (
          <Col span={8} fill><div className="eq-fill">
            <DevNote note="RF304-RGN004 / CTA003: relação manutenção/ativo = manutenção acumulada ÷ valor de aquisição. Sem valor de aquisição, a barra fica zerada e só a manutenção acumulada é exibida, sem erro. Acima de 100% a barra enche e muda de cor. Dado sensível: só Administrador e Gestor (RGN003).">
              <Card title="Custos do ativo" subtitle="Compare os custos de manutenção com o valor de aquisição do equipamento">
                <div className="card-body-tight">
                  <Stack gap="lg">
                    <Grid>
                    <Col span={6}><ReadField label="Valor de aquisição" value={eq.valueCents ? formatMoney(eq.valueCents) : 'Não informado'} /></Col>
                    <Col span={6}><ReadField label="Manutenção acumulada" value={formatMoney(data.spent)} /></Col>
                    </Grid>
                <Stack gap="xs">
                  <Stack direction="horizontal" justify="between" align="center" gap="sm">
                    <span className="read-label">Relação manutenção/ativo</span>
                    <span className="read-value">{eq.valueCents ? `${ratio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '0%'}</span>
                  </Stack>
                  <div className="eq-bar" role="progressbar" aria-label="Relação manutenção/ativo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(ratio))}>
                    <div className={`eq-bar-fill${ratio > 100 ? ' is-over' : ''}`} style={{ width: `${Math.min(100, ratio)}%` }} />
                  </div>
                  {!eq.valueCents && <p className="field-note">Sem valor de aquisição informado, não é possível calcular a relação</p>}
                  {eq.valueCents && ratio >= 50 ? <p className="field-note">{ratio > 100 ? 'A manutenção já custou mais que o valor do equipamento' : 'A manutenção já passou de metade do valor do equipamento'}</p> : null}
                </Stack>
                  </Stack>
                </div>
              </Card>
            </DevNote>
          </div></Col>
        )}
        </Grid>

        {attention.length > 0 && <DevNote note="RF304/RF801 (💡 a confirmar): pontos de atenção do ativo. Um único motivo aparece como alerta individual; dois ou mais ficam agrupados em “Pontos de atenção”, cada item com o ícone da própria severidade. Falhas recorrentes = N corretivas em X dias (documento do cliente: 3 falhas em 90 dias; N e X fixos no protótipo) e também geram notificação (tipo Equipamento) para Administrador e Gestor. As variantes “só parado” e “só falhas recorrentes” são filtros de protótipo para comparar os cenários.">
          <div><AttentionPoints points={attention} /></div>
        </DevNote>}

        <DevNote note="RF304: as seções do ativo ficam em 5 abas (Informações já reúne identificação, localização, ciclo de vida e garantia, fotos e histórico de manutenções). Cada linha de solicitação, OS e preventiva abre o respectivo detalhe (FLU004). O histórico nasce das OS e das execuções de preventiva concluídas (RGN001/CTA001). 💡 RGN002: alerta de reincidência (ex.: 3 falhas em 90 dias) a confirmar - não incluído. Documentos do ativo são FE008 (fora do escopo).">
          <Tab
            aria-label="Informações do equipamento"
            tabs={[
              { label: 'Informações', content: info },
              { label: `Solicitações (${data.requests.length})`, content: <SimpleList id="eq-requests" title="Solicitações" subtitle="Histórico de solicitações deste equipamento" rows={requestRows} columns={requestCols} toItem={requestItem} emptyTitle="Nenhuma solicitação para este equipamento" /> },
              { label: `Ordens de serviço (${data.orders.length})`, content: <SimpleList id="eq-orders" title="Ordens de serviço" subtitle="Ordens de serviço vinculadas a este equipamento" rows={orderRows} columns={orderCols} toItem={orderItem} emptyTitle="Nenhuma OS para este equipamento" /> },
              {
                label: `Preventivas (${activePlans.length})`,
                content: (
                  <Stack gap="xl">
                    <SimpleList id="eq-plans" title="Planos de manutenção ativos" subtitle="Preventivas programadas para este equipamento" rows={planRows} columns={planCols} toItem={planItem} emptyTitle="Nenhum plano de manutenção ativo" emptyDescription="Este equipamento não possui preventivas programadas no momento." />
                    <SimpleList id="eq-execs" title="Histórico de execuções" subtitle="Execuções previstas e realizadas dos planos de manutenção" rows={execRows} columns={execCols} toItem={execItem} emptyTitle="Nenhuma execução registrada" />
                  </Stack>
                ),
              },
              { label: 'Troubleshooting', content: troubleshooting },
            ]}
          />
        </DevNote>
      </Stack>
      <QrDialogs equipment={eq} mode={qr} onMode={setQr} />
      {zoom && (
        <Dialog open onClose={() => setZoom(null)} size="md" title={zoom.title} subtitle={zoom.name}>
          <DevNote note="Visualização ampliada da foto (somente leitura), imagem inteira com texto alternativo. No protótipo só o nome do arquivo é guardado; o Forno combinado 01 resolve o nome para uma foto de exemplo.">
            <div className="eq-photo-zoom">{photoSrc(zoom.name) ? <img src={photoSrc(zoom.name)} alt={`${zoom.title}: ${zoom.name}`} /> : <span role="img" aria-label={`${zoom.title}: ${zoom.name}`}><IconPhoto size={64} aria-hidden="true" /></span>}</div>
          </DevNote>
        </Dialog>
      )}
      {toggling && <EquipmentToggleDialog equipment={eq} onClose={() => setToggling(false)} />}
    </AppLayout>
  );
}

mountApp(<EquipamentoScreen />);
