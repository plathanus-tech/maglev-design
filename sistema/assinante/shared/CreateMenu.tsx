import { IconCalendarRepeat, IconMessageReport, IconMicrowave, IconPlus, IconTruck } from '@tabler/icons-react';
import { DevNote } from '../../admin/shared/dev-notes/DevNote';
import { RowMenu, RowMenuItem } from './RowMenu';
import { useSubSession } from './store';
import { goTo } from './ui';

/**
 * Atalho global de criação ("Criar"): só as ações que o perfil pode cadastrar (permissão "Cadastrar" do módulo). O Solicitante não usa o atalho
 * (já tem o fluxo próprio de solicitação). Sem nenhuma ação, o botão não aparece.
 */
export function useCreateItems(): RowMenuItem[] {
  const { user, can } = useSubSession();
  if (user.profile === 'solicitante') return [];
  return [
    ...(can('solicitacoes', 'cadastrar') ? [{ label: 'Nova solicitação', icon: <IconMessageReport size={16} />, onClick: () => goTo('solicitacao-form.html') }] : []),
    ...(can('equipamentos', 'cadastrar') ? [{ label: 'Novo equipamento', icon: <IconMicrowave size={16} />, onClick: () => goTo('equipamento-form.html') }] : []),
    ...(can('planos', 'cadastrar') ? [{ label: 'Novo plano de manutenção', icon: <IconCalendarRepeat size={16} />, onClick: () => goTo('plano-form.html') }] : []),
    ...(can('prestadores', 'cadastrar') ? [{ label: 'Novo prestador', icon: <IconTruck size={16} />, onClick: () => goTo('prestador-form.html') }] : []),
  ];
}

/** Botão "Criar" com o menu de criação. `iconOnly`: só o "+" (menu lateral recolhido, mobile); `align`: lado em que o menu se alinha ao botão. */
export function CreateMenu({ iconOnly, align, elevated, size, compact, note }: { iconOnly?: boolean; align?: 'start' | 'end'; elevated?: boolean; size?: 'sm' | 'md'; compact?: boolean; note?: string }) {
  const items = useCreateItems();
  if (items.length === 0) return null;
  const button = <RowMenu target="cadastros" label="Criar" items={items} align={align} elevated={elevated} compact={compact} trigger={{ text: 'Criar', icon: <IconPlus size={size === 'sm' ? 16 : 20} />, iconOnly, size }} />;
  return note ? <DevNote note={note}>{button}</DevNote> : button;
}
