import { Button, Dialog, Stack } from '@maglev/ds';
import { IconExternalLink } from '@tabler/icons-react';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { CategoryIcon } from '../../admin/shared/IconPicker';
import { Equipment } from './data';
import { photoSrc } from './photos';
import { environmentName, unitName, useSubSession } from './store';
import { Col, Grid, ReadField, useRefs } from './ui';
import { warrantyLine } from './warranty-ui';

/**
 * Resumo do equipamento (modal): o suficiente do "Perfil do ativo" para a pessoa reconhecer o equipamento sem sair da tela em que está
 * (foto, nome, código, categoria, localização, status, criticidade, garantia e dados do fabricante). "Ver equipamento completo" abre a tela
 * do equipamento em OUTRA aba, para não perder o que já foi preenchido (ex.: o plano em cadastro).
 */
export function EquipmentQuickView({ equipment, onClose }: { equipment: Equipment; onClose: () => void }) {
  const refs = useRefs();
  const { db } = useSubSession();
  const category = refs.category(equipment.categoryId);
  const photo = photoSrc(equipment.photoName);
  const full = `equipamento.html?id=${equipment.id}`;

  return (
    <Dialog
      open onClose={onClose} size="lg" sheet title={equipment.name} subtitle={`${equipment.code || equipment.id} · ${category?.name ?? '-'}`}
      actions={(
        <Button className="btn-block" iconRight={<IconExternalLink size={20} />} onClick={() => window.open(full, '_blank', 'noopener,noreferrer')}>Ver equipamento completo</Button>
      )}
    >
      <DevNote note="Resumo do equipamento (Novo plano, passo Informações): o nome do equipamento na lista é um link que abre este modal, com o que o Perfil do ativo traz de mais útil para reconhecer o equipamento. Clicar no nome não marca nem desmarca o equipamento. “Ver equipamento completo” abre a tela do equipamento em outra aba para a pessoa não perder o plano que está preenchendo (o cadastro é um fluxo com saída protegida).">
        <Stack gap="md">
          <Stack direction="horizontal" gap="md" align="start">
            {photo
              ? <img className="pick-qv-photo" src={photo} alt={`Foto de ${equipment.name}`} />
              : <span className="pick-qv-photo pick-qv-photo--icon" role="img" aria-label="Equipamento sem foto cadastrada"><CategoryIcon id={category?.icon} size={32} /></span>}
            <Grid>
              <Col span={6}><ReadField label="Status" value={refs.statusBadge(equipment.statusId)} /></Col>
              <Col span={6}><ReadField label="Criticidade" value={refs.criticalityBadge(equipment.criticalityId)} /></Col>
              <Col span={12}><ReadField label="Garantia" value={warrantyLine(equipment.warranty)} /></Col>
            </Grid>
          </Stack>
          <Grid>
            <Col span={6}><ReadField label="Unidade" value={unitName(db, equipment.unitId)} /></Col>
            <Col span={6}><ReadField label="Ambiente" value={equipment.environmentId ? environmentName(db, equipment.environmentId) : undefined} /></Col>
            <Col span={4}><ReadField label="Fabricante" value={equipment.maker} /></Col>
            <Col span={4}><ReadField label="Modelo" value={equipment.model} /></Col>
            <Col span={4}><ReadField label="Número de série" value={equipment.serial} /></Col>
          </Grid>
        </Stack>
      </DevNote>
    </Dialog>
  );
}
