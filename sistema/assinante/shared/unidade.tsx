import { useEffect, useState } from 'react';
import { IconBuildingStore, IconCircleCheck, IconCircleOff, IconPencil, IconTrash } from '@tabler/icons-react';
import { Button, Card, EmptyState, Stack, useToast } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { useHashState } from '../../admin/shared/useHashState';
import { formatCep, formatNumber, formatPhone } from '../../admin/shared/format';
import { AppLayout, PageHeader, mountApp } from './AppLayout';
import { Unit } from './data';
import { nextSeq, userName, useSubSession } from './store';
import { unitLinks } from './estrutura-utils';
import { UnitDialogs, demoDeletableUnit } from './unidade-dialogs';
import { Col, Grid, ReadField, goTo, param, recordStatusBadge, setFlash, takeFlash } from './ui';

/** Estados: idle · deactivate (confirmar inativação/ativação) · delete (confirmar exclusão) · deleteblocked (exclusão bloqueada por vínculos) */
const STATES = ['idle', 'deactivate', 'delete', 'deleteblocked'] as const;
type Mode = (typeof STATES)[number];

const link = (href: string, text: string) => <a className="text-link" href={href}>{text}</a>;

function UnidadeScreen() {
  const toast = useToast();
  const { db, can, unitIds, company } = useSubSession();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [toggling, setToggling] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const unit = db.units.find((u) => u.id === param('id') && unitIds.includes(u.id));

  useEffect(() => { const f = takeFlash(); if (f) toast.show(f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!unit) return;
    if (mode === 'deactivate' && can('unidades', 'ativar')) setToggling(unit);
    if (mode === 'delete' && unitLinks(db, unit.id).total > 0) {
      // Variante: precisa de uma unidade sem vínculos; abre a de demonstração (criada se não houver)
      const demo = demoDeletableUnit(db, company.tradeName, nextSeq('UNI', db.units.map((u) => u.id), 3));
      window.location.replace(`unidade.html?id=${demo.id}#state=delete`);
      return;
    }
    if ((mode === 'delete' || mode === 'deleteblocked') && can('unidades', 'excluir')) setDeleting(unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, !!unit]);

  if (!unit) {
    return (
      <AppLayout active="unidades" screen="unidades">
        <Card>
          <EmptyState
            icon={<IconBuildingStore size={32} />} title="Unidade não encontrada" description="Ela pode ter sido excluída ou você não tem acesso a ela"
            action={<Button variant="secondary" onClick={() => goTo('unidades.html')}>Voltar para unidades</Button>}
          />
        </Card>
        <UnitDialogs toggling={null} deleting={null} setToggling={setToggling} setDeleting={setDeleting} />
      </AppLayout>
    );
  }

  const links = unitLinks(db, unit.id);
  const active = unit.status === 'ativo';
  const canEdit = can('unidades', 'editar');
  const canToggle = can('unidades', 'ativar');
  const canDelete = can('unidades', 'excluir');
  const hasActions = canEdit || canToggle || canDelete;

  return (
    <AppLayout active="unidades" screen="unidades">
      <Stack gap="xl">
        <PageHeader
          title={unit.name}
          badge={recordStatusBadge(unit.status)}
          breadcrumb={[{ label: 'Unidades', href: 'unidades.html' }, { label: unit.name }]}
          actions={hasActions && (
              <>
                {canDelete && <Button variant="secondary" iconLeft={<IconTrash size={20} />} onClick={() => setDeleting(unit)}>Excluir</Button>}
                {canToggle && (
                  <Button variant="secondary" iconLeft={active ? <IconCircleOff size={20} /> : <IconCircleCheck size={20} />} onClick={() => setToggling(unit)}>
                    {active ? 'Inativar' : 'Ativar'}
                  </Button>
                )}
                {canEdit && (
                  <DevNote note="RF202-RGN002: padrão de tela - visualização com campos em leitura; as ações aparecem conforme a permissão do perfil (Editar, Ativar/Inativar, Excluir). Perfil sem permissão de edição vê só a leitura.">
                    <Button iconLeft={<IconPencil size={20} />} onClick={() => goTo(`unidade-form.html?id=${unit.id}`)}>Editar</Button>
                  </DevNote>
                )}
              </>
          )}
        />

        <Card className="card-open" title="Dados da unidade" subtitle="Como a unidade aparece nas listagens e solicitações">
          <div className="card-body-tight">
            <Grid>
              <Col span={6}><ReadField label="Nome da unidade" value={unit.name} /></Col>
              <Col span={6}><ReadField label="Código interno" value={unit.code} /></Col>
              <Col span={6}><ReadField label="Telefone" value={unit.phone ? formatPhone(unit.phone) : ''} /></Col>
              <Col span={6}><ReadField label="Responsável" value={userName(db, unit.managerId)} /></Col>
              <Col span={6}><ReadField label="Status" value={recordStatusBadge(unit.status)} /></Col>
            </Grid>
          </div>
        </Card>

        <Card className="card-open" title="Endereço" subtitle="Onde a unidade funciona">
          <div className="card-body-tight">
            <Grid>
              <Col span={4}><ReadField label="CEP" value={unit.cep ? formatCep(unit.cep) : ''} /></Col>
              <Col span={12}><ReadField label="Logradouro" value={unit.street} /></Col>
              <Col span={6}><ReadField label="Número" value={unit.number} /></Col>
              <Col span={6}><ReadField label="Bairro" value={unit.district} /></Col>
              <Col span={6}><ReadField label="Cidade" value={unit.city} /></Col>
              <Col span={6}><ReadField label="Estado" value={unit.uf} /></Col>
            </Grid>
          </div>
        </Card>

        <DevNote note="Resumo da estrutura da unidade: quantidade de ambientes (RF203) e de equipamentos, com atalho para a listagem já filtrada por esta unidade.">
          <Card className="card-open" title="Resumo" subtitle="O que está cadastrado nesta unidade">
            <div className="card-body-tight">
              <Grid>
                <Col span={6}>
                  <ReadField
                    label="Ambientes"
                    value={links.environments ? <>{formatNumber(links.environments)} · {link(`ambientes.html?unit=${unit.id}`, 'Ver ambientes')}</> : 'Nenhum ambiente cadastrado'}
                  />
                </Col>
                <Col span={6}>
                  <ReadField
                    label="Equipamentos"
                    value={links.equipments ? <>{formatNumber(links.equipments)} · {link(`equipamentos.html?unit=${unit.id}`, 'Ver equipamentos')}</> : 'Nenhum equipamento cadastrado'}
                  />
                </Col>
              </Grid>
            </div>
          </Card>
        </DevNote>
      </Stack>

      <UnitDialogs
        toggling={toggling} deleting={deleting} setToggling={setToggling} setDeleting={setDeleting}
        onDeleted={(u) => { setFlash({ type: 'success', title: 'Unidade excluída', message: `${u.name} foi removida` }); goTo('unidades.html'); }}
      />
    </AppLayout>
  );
}

mountApp(<UnidadeScreen />);
