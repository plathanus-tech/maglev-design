import { Button, Dialog, Stack } from '@maglev/ds';
import { useSession } from './store';
import { formatNumber } from './format';
import { Text } from './ui';

/** Confirmação de ativar/inativar (mesmo padrão de Usuários): título com o nome, texto do efeito e ação em largura total. */
export function StatusConfirmDialog({ name, deactivate, detail, links = 0, linkLabel = 'registros', onClose, onConfirm }: {
  name: string; deactivate: boolean; detail: string; links?: number; linkLabel?: string; onClose: () => void; onConfirm: () => void;
}) {
  const { usage } = useReach(links, linkLabel);
  return (
    <Dialog
      open size="sm" onClose={onClose}
      title={deactivate ? `Inativar ${name}?` : `Ativar ${name}?`}
      actions={(
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={deactivate ? 'destructive' : 'primary'} onClick={onConfirm}>{deactivate ? 'Inativar' : 'Ativar'}</Button>
        </>
      )}
    >
      <Stack gap="sm">
        <Text>{detail}</Text>
        <Text>{`Vale para todos os assinantes. ${usage}`}</Text>
      </Stack>
    </Dialog>
  );
}

/** Singular dos rótulos de vínculo (usado quando há exatamente 1 vínculo). */
export const SINGULAR: Record<string, string> = { prestadores: 'prestador', equipamentos: 'equipamento', 'solicitações': 'solicitação', registros: 'registro', chamados: 'chamado' };

/**
 * Alcance de uma alteração: todos os cadastros de Configurações são globais (valem para todos os assinantes), então basta dizer quanto
 * já está em uso e em quantos assinantes, sem listar redes. DADOS DE DEMONSTRAÇÃO: os assinantes alcançados são estimados a partir dos vínculos.
 */
export function useReach(links: number, linkLabel: string) {
  const { db } = useSession();
  const live = db.subscribers.filter((x) => x.status !== 'inativo').length;
  const subs = links <= 0 ? 0 : Math.min(live, Math.max(1, Math.ceil(links / 18)));
  const usage = links <= 0
    ? 'Ainda não está em uso por nenhum assinante'
    : `Em uso em ${formatNumber(links)} ${links === 1 ? SINGULAR[linkLabel] ?? linkLabel : linkLabel} de ${subs} ${subs === 1 ? 'assinante' : 'assinantes'}`;
  const noun = links === 1 ? SINGULAR[linkLabel] ?? linkLabel : linkLabel;
  return { subs, usage, noun };
}
