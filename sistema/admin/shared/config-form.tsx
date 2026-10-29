import { FormEvent, useState } from 'react';
import { Button, Input, MultiSelect, RadioButton, Stack, Textarea } from '@maglev/ds';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { DevNote } from './dev-notes/DevNote';
import { getSessionUser, logActivity, updateDb, useSession } from './store';
import { ConfigItem, RecordStatus } from './data';
import { normalize, requiredMessage } from './format';
import { IconPicker } from './IconPicker';
import { ScopeCard, Scope, scopeError, scopeOf } from './config-scope';
import { StatusConfirmDialog } from './config-confirm';
import { useHashState } from './useHashState';
import { Col, FormSection, Grid, goTo, param, setFlash } from './ui';

/**
 * Nova/Editar em página própria (e não em modal) dos cadastros que têm Alcance por assinante: Categorias (RF402), Tipos de solicitação (RF403) e
 * Tipos de manutenção (RF404). A tela é escolhida por `data-kind` no <body>. Escolher exceções entre muitos assinantes pede busca, seleção em lote e espaço.
 */
type Kind = 'categories' | 'requestTypes' | 'maintenanceTypes';
const KINDS: Record<Kind, { noun: string; fem: boolean; newTitle: string; list: string; crumb: string; subtitle: string; logName: string }> = {
  categories: { noun: 'categoria', fem: true, newTitle: 'Nova categoria', list: 'configuracoes-categorias.html', crumb: 'Categorias de equipamentos', subtitle: 'Define como os equipamentos dos assinantes são agrupados', logName: 'a categoria' },
  requestTypes: { noun: 'tipo de solicitação', fem: false, newTitle: 'Novo tipo de solicitação', list: 'configuracoes-tipos-solicitacao.html', crumb: 'Tipos de solicitação', subtitle: 'Tipo de problema oferecido na abertura de solicitações', logName: 'o tipo de solicitação' },
  maintenanceTypes: { noun: 'tipo de manutenção', fem: false, newTitle: 'Novo tipo de manutenção', list: 'configuracoes-tipos-manutencao.html', crumb: 'Tipos de manutenção', subtitle: 'Usado na triagem e nas ordens de serviço', logName: 'o tipo de manutenção' },
};
/** Estados: idle · required (campos obrigatórios) */
const STATES = ['idle', 'required'] as const;

function ConfigFormScreen({ kind }: { kind: Kind }) {
  const meta = KINDS[kind];
  const { db } = useSession();
  const editing: ConfigItem | undefined = db[kind].find((c) => c.id === param('id'));
  const [mode] = useHashState(STATES, 'idle');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [icon, setIcon] = useState<string | undefined>(editing?.icon);
  const [categoryIds, setCategoryIds] = useState<string[]>(editing?.categoryIds ?? []);
  const [status, setStatus] = useState<RecordStatus>(editing?.status ?? 'ativo');
  const [scope, setScope] = useState<Scope>(scopeOf(editing?.exceptionIds));
  const [exceptions, setExceptions] = useState<string[]>(editing?.exceptionIds ?? []);
  const [tried, setTried] = useState(mode === 'required');
  const [saving, setSaving] = useState(false);
  // Mudou o Status de um registro existente: depois de Salvar, pede confirmação (mesmo modal da lista)
  const [confirming, setConfirming] = useState(false);

  const dup = db[kind].some((c) => c.id !== editing?.id && normalize(c.name) === normalize(name));
  const problems = {
    name: !name.trim() ? requiredMessage('Nome') : dup ? `Já existe ${meta.fem ? 'uma' : 'um'} ${meta.noun} com este nome` : undefined,
    scope: scopeError(scope, exceptions),
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : undefined);
  const invalid = Object.values(problems).some(Boolean);
  const categoryOptions = db.categories.filter((c) => c.status === 'ativo' || editing?.categoryIds?.includes(c.id)).map((c) => ({ value: c.id, label: c.name }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) {
      window.setTimeout(() => { const f = document.querySelector<HTMLElement>('form [aria-invalid="true"]'); f?.scrollIntoView({ block: 'center' }); f?.focus({ preventScroll: true }); }, 0);
      return;
    }
    if (editing && status !== editing.status) { setConfirming(true); return; }
    commit();
  };

  const commit = () => {
    setSaving(true);
    const data = {
      name: name.trim(), description: description.trim(), status: editing ? status : ('ativo' as RecordStatus),
      ...(kind === 'categories' ? { icon } : {}),
      ...(kind === 'requestTypes' ? { categoryIds: categoryIds.length ? categoryIds : undefined } : {}),
      exceptionIds: scope === 'except' ? exceptions : undefined,
    };
    updateDb((d) => ({
      ...d,
      [kind]: editing ? d[kind].map((c) => (c.id === editing.id ? { ...c, ...data } : c)) : [...d[kind], { id: `${kind}-${Date.now()}`, links: 0, ...data }],
    }));
    logActivity(getSessionUser().id, 'Configurações', editing ? 'edicao' : 'cadastro', `${editing ? 'Editou' : 'Cadastrou'} ${meta.logName} ${data.name}`);
    setFlash({ type: 'success', title: editing ? 'Registro atualizado' : 'Registro cadastrado', message: `“${data.name}” foi salvo.` });
    window.setTimeout(() => goTo(meta.list), 300);
  };

  return (
    <AppLayout active={meta.list.replace(/\.html$/, '')} screen="configuracoes">
      <form className="form-page" onSubmit={onSubmit} noValidate>
        <Stack gap="xl">
          <PageHeader
            title={editing ? `Editar ${editing.name}` : meta.newTitle}
            subtitle={meta.subtitle}
            breadcrumb={[{ label: meta.crumb, href: meta.list }, { label: editing ? 'Editar' : meta.newTitle }]}
          />

          <DevNote note="Nome obrigatório e único dentro do cadastro (RF401-CTA003); comparação sem diferenciar maiúsculas e acentos.">
            <FormSection className="card-open" title={`Dados d${meta.fem ? 'a' : 'o'} ${meta.noun}`}>
              <div className="card-body-tight">
                <Grid>
                  <Col span={12}><Input label="Nome" required value={name} onChange={(e) => setName(e.target.value)} error={show('name')} /></Col>
                  {kind === 'categories' && (
                    <Col span={12}>
                      <DevNote note="Ícone opcional da categoria: escolhido num catálogo curado de ícones Tabler com nome e palavras-chave em português. Salva-se só o identificador estável do ícone.">
                        <IconPicker value={icon} onChange={setIcon} />
                      </DevNote>
                    </Col>
                  )}
                  <Col span={12}><Textarea optional label="Descrição" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Col>
                  {kind === 'requestTypes' && (
                    <Col span={12}>
                      <DevNote note="Categorias em que o tipo é oferecido na Nova solicitação (portal e QR Code): com um equipamento escolhido, aparecem os tipos sem categoria (valem para todas) e os que incluem a categoria dele. Sem categoria marcada = todas. Só categorias ativas; uma categoria já vinculada e depois inativada continua aparecendo aqui.">
                        <Stack gap="xs">
                          <MultiSelect optional label="Categorias" placeholder="Todas as categorias" removeLabel={(l) => `Remover categoria ${l}`} options={categoryOptions} value={categoryIds} onChange={setCategoryIds} />
                          <p className="field-note">Sem categoria marcada, o tipo é oferecido para todos os equipamentos</p>
                        </Stack>
                      </DevNote>
                    </Col>
                  )}
                  {editing && (
                    <Col span={12}><RadioButton name="cfg-status" label="Status" orientation="horizontal" options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={(v) => setStatus(v as RecordStatus)} /></Col>
                  )}
                </Grid>
              </div>
            </FormSection>
          </DevNote>

          <ScopeCard noun={meta.noun} fem={meta.fem} scope={scope} onScope={setScope} exceptions={exceptions} onExceptions={setExceptions} error={show('scope')} />

          {confirming && editing && (
            <StatusConfirmDialog
              name={editing.name} links={editing.links} linkLabel={kind === 'categories' ? 'equipamentos' : kind === 'requestTypes' ? 'solicitações' : 'OS'} deactivate={status === 'inativo'}
              detail={status === 'inativo' ? `Deixa de ser oferecid${meta.fem ? 'a' : 'o'} em novos cadastros, mas continua nos registros antigos.` : `Volta a ser oferecid${meta.fem ? 'a' : 'o'} nas telas de cadastro.`}
              onClose={() => setConfirming(false)}
              onConfirm={() => { setConfirming(false); commit(); }}
            />
          )}
          <Stack direction="horizontal" justify="start" gap="sm" wrap className="form-actions">
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : `Cadastrar ${meta.noun}`}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => goTo(meta.list)}>Cancelar</Button>
          </Stack>
        </Stack>
      </form>
    </AppLayout>
  );
}

mountApp(<ConfigFormScreen kind={(document.body.dataset.kind as Kind) ?? 'categories'} />);
