import { FormEvent, useState } from 'react';
import { IconAlertCircle, IconClipboardList, IconClipboardPlus, IconPhoto, IconSearch } from '@tabler/icons-react';
import { Badge, Button, Card, EmptyState, Feedback, Input, Stack } from '@maglev/ds';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { formatDateTime } from '../../admin/shared/format';
import { useHashState } from '../../admin/shared/useHashState';
import { ExternalLayout, PageHeader, mountApp } from '../../externo/shared/ExternalLayout';
import { photoSrc } from '../../assinante/shared/photos';
import { useSubDb } from '../../assinante/shared/store';
import { goTo, param } from '../../assinante/shared/ui';
import { OpenRequestCard } from './open-request-card';
import { EquipmentSearch } from './busca-equipamento';
import { equipmentFromLink, linkToRequest, openRequestsOf, simpleStatus, useBlockedReason, useRefs } from './lib';

/** Estados: idle · inactive (equipamento inativo) · envinactive (ambiente do assinante desativado) · notfound (QR inválido) */
const STATES = ['idle', 'inactive', 'envinactive', 'notfound', 'searchfound', 'searchnotfound'] as const;
type Mode = (typeof STATES)[number];

/**
 * Resumo do equipamento via QR Code (Colaborador RF001) com as solicitações já abertas (RF003). Sem login: só dados
 * não sensíveis (nome, foto, código, status, unidade, ambiente, categoria, fabricante, modelo) - nunca valor, custos ou histórico (RGN002).
 */
function EquipamentoColaboradorScreen() {
  const db = useSubDb();
  const refs = useRefs();
  const [mode] = useHashState<Mode>(STATES, 'idle');
  const [protocol, setProtocol] = useState('');
  const [protocolError, setProtocolError] = useState<string>();
  const eq = mode === 'notfound' ? undefined : equipmentFromLink(db) ?? (mode === 'idle' || mode === 'searchfound' || mode === 'searchnotfound' ? undefined : db.equipments[0]);
  const blocked = useBlockedReason(db, eq, mode === 'inactive' || mode === 'envinactive' ? mode : undefined);

  const shell = (content: React.ReactNode) => <ExternalLayout area="Solicitação de manutenção">{content}</ExternalLayout>;

  // Sem QR Code nem equipamento na URL (acesso pelo endereço da plataforma): busca por código
  const bySearch = !param('q') && !param('e') && mode !== 'notfound';
  if (!eq && bySearch) {
    return shell(<EquipmentSearch demo={mode === 'searchfound' ? 'found' : mode === 'searchnotfound' ? 'notfound' : undefined} />);
  }
  if (!eq) {
    return shell(
      <div className="ext-empty is-center is-error">
        <EmptyState
          compact icon={<IconAlertCircle size={32} />} title="Equipamento não encontrado"
          description="Não foi possível identificar o equipamento. Escaneie o QR Code novamente ou procure o responsável pela unidade." headingLevel={1}
        />
      </div>,
    );
  }

  const unit = db.units.find((u) => u.id === eq.unitId);
  const env = db.environments.find((x) => x.id === eq.environmentId);
  const category = refs.category(eq.categoryId)?.name;
  const open = openRequestsOf(db, refs.base, eq.id);
  const photo = photoSrc(eq.photoName);

  const search = (ev: FormEvent) => {
    ev.preventDefault();
    const id = protocol.trim().toUpperCase();
    if (!id) { setProtocolError('O campo Protocolo é obrigatório'); return; }
    const r = db.requests.find((x) => x.id === id);
    if (!r) { setProtocolError('Não encontramos uma solicitação com este protocolo'); return; }
    goTo(linkToRequest(r.id));
  };

  return shell(
    <Stack gap="lg">
      <div className={blocked ? 'ext-notice-group' : undefined}>
        <PageHeader title={eq.name} subtitle={`${eq.code} · ${unit?.name ?? ''}`} />
        {blocked === 'inactive' && (
          <DevNote note="Colaborador RF001-RGN003: equipamento inativo não permite abrir solicitação (a regra continua valendo na tela de solicitar); as informações do equipamento seguem visíveis.">
            <Feedback type="warning" title="Equipamento inativo" message="Não é possível abrir novas solicitações para este equipamento. Se precisar de ajuda, procure o responsável pela manutenção." />
          </DevNote>
        )}
        {blocked === 'envinactive' && (
          <DevNote note="Colaborador RF001-RGN003: ambiente do assinante desativado (a empresa fica sem acesso) não permite abrir solicitação; a regra continua valendo na tela de solicitar. O status do equipamento não muda por causa disso. No texto ao usuário evita-se “ambiente”, que pode ser confundido com o ambiente físico do equipamento.">
            <Feedback type="warning" title="Solicitações indisponíveis" message="O acesso da empresa está desativado. Não é possível abrir novas solicitações." />
          </DevNote>
        )}
      </div>

      <DevNote note="Colaborador RF001-FLU002 / RGN002 / CTA002: resumo do equipamento sem login. 💡 A confirmar quais dados o solicitante não autenticado pode ver (sugestão: categoria, fabricante, modelo). Valor, custos e histórico completo nunca aparecem aqui.">
        <Card title="Resumo do equipamento" actions={refs.statusBadge(blocked === 'inactive' ? 'STE-05' : eq.statusId)}>
          <Stack gap="lg">
            <div className="ext-eq-photo" role="img" aria-label={photo ? `Foto de ${eq.name}` : 'Equipamento sem foto'}>
              {photo ? <img src={photo} alt="" /> : <IconPhoto size={32} aria-hidden="true" />}
            </div>
            <dl className="ext-kv">
              <div><dt>Código</dt><dd>{eq.code}</dd></div>
              <div><dt>Categoria</dt><dd>{category ?? '-'}</dd></div>
              <div><dt>Unidade</dt><dd>{unit?.name ?? '-'}</dd></div>
              <div><dt>Ambiente</dt><dd>{env?.name ?? '-'}</dd></div>
              <div><dt>Fabricante</dt><dd>{eq.maker || '-'}</dd></div>
              <div><dt>Modelo</dt><dd>{eq.model || '-'}</dd></div>
            </dl>
            {!blocked && (
              <div className="ext-actions">
                <Button iconLeft={<IconClipboardPlus size={20} />} onClick={() => goTo(`solicitar.html?q=${eq.qrToken}`)}>Abrir solicitação</Button>
              </div>
            )}
          </Stack>
        </Card>
      </DevNote>

      <DevNote note="Colaborador RF003 / RGN001 / RGN002: solicitações em aberto do equipamento (status simplificado, protocolo, responsável e previsão), sem dados pessoais de outros solicitantes. O sistema avisa da duplicidade, mas nunca impede uma nova solicitação (RF002-RGN005).">
        <Card title="Solicitações em aberto" subtitle={open.length ? 'Confira se o seu problema já foi relatado antes de abrir uma nova solicitação' : undefined}>
          {open.length === 0 ? (
            <div className="ext-empty is-inline"><EmptyState compact icon={<IconClipboardList size={32} />} title="Nenhuma solicitação em aberto" description="Este equipamento não tem solicitações em andamento" headingLevel={3} /></div>
          ) : (
            <Stack gap="md">
              {open.map((r) => <OpenRequestCard key={r.id} request={r} href={linkToRequest(r.id)} />)}
            </Stack>
          )}
        </Card>
      </DevNote>

      <DevNote note="Colaborador RF004-FLU001 / RGN003: o acompanhamento pode ser aberto informando o protocolo. 💡 A confirmar se exige também o telefone informado na abertura, para proteger os dados.">
        <Card title="Acompanhar uma solicitação" subtitle="Já abriu uma solicitação? Informe o protocolo">
          <form onSubmit={search} noValidate>
            <Stack gap="md">
              <Input label="Protocolo" placeholder="SOL-000000" autoComplete="off" value={protocol} onChange={(e) => { setProtocol(e.target.value); setProtocolError(undefined); }} error={protocolError} />
              <div className="ext-actions"><Button type="submit" variant="secondary" iconLeft={<IconSearch size={20} />}>Acompanhar</Button></div>
            </Stack>
          </form>
        </Card>
      </DevNote>
    </Stack>,
  );
}

mountApp(<EquipamentoColaboradorScreen />);
