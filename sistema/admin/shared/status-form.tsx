import { FormEvent, useState } from 'react';
import { Button, Dropdown, Input, RadioButton, Stack } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { getSessionUser, logActivity, updateDb, useSession } from './store';
import { BASE_SITUATIONS, BaseSituation, RecordStatus, STATUS_MODULES, StatusModule, VISUALS, Visual, moduleLabel } from './data';
import { normalize, requiredMessage } from './format';
import { placeStatus, positionKey, positionOptions, renumber, siblingsOf } from './config-status-lib';
import { ScopeCard, Scope, scopeError, scopeOf } from './config-scope';
import { StatusConfirmDialog } from './config-confirm';
import { useHashState } from './useHashState';
import { Col, FormSection, Grid, Text, goTo, param, setFlash, statusBadgeOf } from './ui';

/** RF407 - Novo/Editar status em página própria (alcance com exceções por assinante). Estados: idle · required (campos obrigatórios). */
const STATES = ['idle', 'required'] as const;
const LIST = 'configuracoes-status.html';

function StatusFormScreen() {
  const { db } = useSession();
  const all = db.statuses;
  const item = all.find((s) => s.id === param('id'));
  const [mode] = useHashState(STATES, 'idle');
  const [name, setName] = useState(item?.name ?? '');
  const [visual, setVisual] = useState<Visual | ''>(item?.visual ?? '');
  const [module, setModule] = useState<StatusModule | ''>(item?.module ?? '');
  const [base, setBase] = useState<BaseSituation | ''>(item?.base ?? '');
  const [position, setPosition] = useState(item ? positionKey(siblingsOf(all, item.module, item.id), siblingsOf(all, item.module).findIndex((s) => s.id === item.id)) : 'end');
  const [status, setStatus] = useState<RecordStatus>(item?.status ?? 'ativo');
  const [scope, setScope] = useState<Scope>(scopeOf(item?.exceptionIds));
  const [exceptions, setExceptions] = useState<string[]>(item?.exceptionIds ?? []);
  const [tried, setTried] = useState(mode === 'required');
  const [saving, setSaving] = useState(false);
  // Mudou o Status de um registro existente: depois de Salvar, pede confirmação (mesmo modal da lista)
  const [confirming, setConfirming] = useState(false);

  const positions = positionOptions(siblingsOf(all, module, item?.id));
  // Linha da ordem: status do módulo na sequência, com o atual inserido na posição escolhida
  const flow = (() => {
    const sib = siblingsOf(all, module, item?.id);
    const index = position === 'start' ? 0 : position === 'end' ? sib.length : sib.findIndex((x) => x.id === position.slice(6)) + 1;
    const rows: Array<{ id: string; name: string; visual: Visual; current?: boolean }> = sib.map((x) => ({ id: x.id, name: x.name, visual: x.visual }));
    rows.splice(index, 0, { id: '__current', name, visual: visual as Visual, current: true });
    return rows;
  })();
  const dup = all.some((s) => s.id !== item?.id && s.module === module && normalize(s.name) === normalize(name));
  const req = (ok: boolean, field: string) => (!ok ? requiredMessage(field) : undefined);
  const problems = {
    module: req(!!module, 'Módulo / etapa'),
    name: req(!!name.trim(), 'Nome') ?? (dup ? 'Já existe um status com este nome neste módulo' : undefined),
    visual: req(!!visual, 'Tipo visual'),
    base: req(!!base, 'Situação-base'),
    scope: scopeError(scope, exceptions),
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) {
      window.setTimeout(() => { const f = document.querySelector<HTMLElement>('form [aria-invalid="true"]'); f?.scrollIntoView({ block: 'center' }); f?.focus({ preventScroll: true }); }, 0);
      return;
    }
    if (item && status !== item.status) { setConfirming(true); return; }
    commit();
  };

  const commit = () => {
    setSaving(true);
    const fields = { module: module as StatusModule, name: name.trim(), visual: visual as Visual, base: base as BaseSituation, status: item ? status : ('ativo' as RecordStatus), exceptionIds: scope === 'except' ? exceptions : undefined };
    updateDb((d) => {
      if (item) {
        const placed = placeStatus(d.statuses.map((x) => (x.id === item.id ? { ...x, ...fields } : x)), item.id, position);
        return { ...d, statuses: item.module === fields.module ? placed : renumber(placed, item.module) };
      }
      const id = `ST-${Date.now()}`;
      return { ...d, statuses: placeStatus([...d.statuses, { id, links: 0, order: 0, ...fields }], id, position) };
    });
    logActivity(getSessionUser().id, 'Configurações', item ? 'edicao' : 'cadastro', `${item ? 'Editou' : 'Cadastrou'} o status ${fields.name}`);
    setFlash({ type: 'success', title: item ? 'Status atualizado' : 'Status cadastrado', message: item ? 'Nome e tipo visual refletem em todas as telas (CTA002).' : `“${fields.name}” já pode ser usado em ${moduleLabel(fields.module)}.` });
    window.setTimeout(() => goTo(LIST), 300);
  };

  return (
    <AppLayout active="configuracoes-status" screen="configuracoes">
      <form className="form-page" onSubmit={onSubmit} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={item ? `Editar ${item.name}` : 'Novo status'}
            subtitle="Status configurável por módulo, com tipo visual e situação-base"
            breadcrumb={[{ label: 'Status', href: LIST }, { label: item ? 'Editar' : 'Novo status' }]}
          />

          <FormSection className="card-open" title="Dados do status">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}><Input label="Nome" required value={name} onChange={(e) => setName(e.target.value)} error={show('name')} /></Col>
                <Col span={6}>
                  <DevNote note="FLU003 / CTA003: escolha obrigatória entre os 5 tipos visuais fixos - não há cor livre.">
                    <Dropdown label="Tipo visual" required options={VISUALS.map((v) => ({ value: v.value, label: v.label }))} value={visual} onChange={(v) => setVisual(v as Visual)} error={show('visual')} />
                  </DevNote>
                </Col>
                <Col span={6}>
                  <DevNote note="FLU002: o status pertence a um módulo/etapa e só aparece nele (CTA004).">
                    <Dropdown label="Módulo / etapa" required options={STATUS_MODULES} value={module} onChange={(v) => { setModule(v as StatusModule); setPosition('end'); }} error={show('module')} />
                  </DevNote>
                </Col>
                <Col span={6}>
                  <DevNote note="💡 Proposta técnica (RGN004): a situação-base é fixa do sistema e é o que as regras automáticas usam (encerrar solicitação, contar downtime, bloquear execução em “Aguardando aprovação”). Validar com a cliente e o desenvolvimento.">
                    <Dropdown label="Situação-base" required options={BASE_SITUATIONS} value={base} onChange={(v) => setBase(v as BaseSituation)} error={show('base')} />
                  </DevNote>
                </Col>
                <Col span={6}>
                  <DevNote note="A posição é escolhida em relação aos status do mesmo módulo/etapa (No início, Depois de…, No final; padrão: No final). O sistema guarda a ordem numérica internamente e renumera os demais: não há campo de número nem posições repetidas.">
                    <Dropdown label="Posição no fluxo" options={positions} value={position} onChange={setPosition} disabled={!module} helperText="Define onde o status aparece no fluxo." />
                  </DevNote>
                </Col>
                {item && (
                  <Col span={6}>
                    <RadioButton name="st-status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as RecordStatus)} />
                  </Col>
                )}
                {module && (
                  <Col span={12}>
                    <DevNote note="Linha da ordem dos status do módulo/etapa: mostra os status atuais na sequência e onde este ficará (destacado), acompanhando a escolha de “Posição no fluxo”. É só leitura; a ordem numérica continua interna.">
                      <Stack gap="xs">
                        <Text>Ordem dos status neste módulo</Text>
                        <ol className="status-flow" aria-label="Ordem dos status neste módulo">
                          {flow.map((f, i) => (
                            <li key={f.id} className={f.current ? 'status-flow-item is-current' : 'status-flow-item'} aria-current={f.current ? 'step' : undefined}>
                              <span className="status-flow-num" aria-hidden="true">{i + 1}</span>
                              {f.current ? statusBadgeOf((visual || 'neutro') as Visual, name.trim() || 'Nome do status') : statusBadgeOf(f.visual, f.name)}
                            </li>
                          ))}
                        </ol>
                      </Stack>
                    </DevNote>
                  </Col>
                )}
              </Grid>
            </div>
          </FormSection>

          <ScopeCard noun="status" scope={scope} onScope={setScope} exceptions={exceptions} onExceptions={setExceptions} error={show('scope')} />

          {confirming && item && (
            <StatusConfirmDialog
              name={item.name} links={item.links} linkLabel="registros" deactivate={status === 'inativo'}
              detail={status === 'inativo' ? `Deixa de ser oferecido em ${moduleLabel(item.module)}, mas continua nos registros antigos.` : `Volta a ser oferecido em ${moduleLabel(item.module)}.`}
              onClose={() => setConfirming(false)}
              onConfirm={() => { setConfirming(false); commit(); }}
            />
          )}
          <Stack direction="horizontal" justify="start" gap="sm" wrap>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : item ? 'Salvar alterações' : 'Cadastrar status'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => goTo(LIST)}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<StatusFormScreen />);
