import { ReactNode, useState } from 'react';
import { IconCalendarRepeat, IconMessageReport, IconMicrowave, IconPlus, IconTruck } from '@tabler/icons-react';
import { goTo } from './ui';
import { OpenByCode } from './open-by-code';

/** Telas de formulário não mostram a barra (a pessoa está no meio do preenchimento e as criações a distrairiam). */
export const bottomNavHidden = () => /-form\.html$/.test(location.pathname);

interface NavAction { key: string; /** Primeira linha do rótulo ("Nova"/"Novo") e o que será criado. */ verb: string; label: string; name: string; icon: ReactNode; href?: string }
/** Criações do módulo, só as que o perfil pode cadastrar: as mesmas do "+" do Início. */
export const bottomNavActions = (can: (screen: never, action?: never) => boolean): NavAction[] => {
  const ok = (screen: string) => (can as unknown as (s: string, a: string) => boolean)(screen, 'cadastrar');
  return [
    ...(ok('solicitacoes') ? [{ key: 'solicitacao', verb: 'Nova', label: 'solicitação', name: 'Nova solicitação', icon: <IconMessageReport size={24} /> }] : []),
    ...(ok('equipamentos') ? [{ key: 'equipamento', verb: 'Novo', label: 'equipamento', name: 'Novo equipamento', icon: <IconMicrowave size={24} />, href: 'equipamento-form.html' }] : []),
    ...(ok('planos') ? [{ key: 'plano', verb: 'Novo', label: 'plano', name: 'Novo plano de manutenção', icon: <IconCalendarRepeat size={24} />, href: 'plano-form.html' }] : []),
    ...(ok('prestadores') ? [{ key: 'prestador', verb: 'Novo', label: 'prestador', name: 'Novo prestador', icon: <IconTruck size={24} />, href: 'prestador-form.html' }] : []),
  ];
};

/** Barra inferior (só mobile): as criações do Início sempre à mão. "Solicitação" já abre a leitura do QR Code (com a opção de abrir sem QR Code). */
export function BottomNav({ items }: { items: NavAction[] }) {
  const [qr, setQr] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <nav className="app-bottomnav" aria-label="Criar">
        {items.map((i) => (
          <button key={i.key} type="button" className="app-bottomnav-item" aria-label={i.name} onClick={() => (i.href ? goTo(i.href) : setQr(true))}>
            <span className="app-bottomnav-icon" aria-hidden="true">{i.icon}<span className="app-bottomnav-plus"><IconPlus size={10} stroke={3} /></span></span>
            <span className="app-bottomnav-label" aria-hidden="true"><span>{i.verb}</span><span>{i.label}</span></span>
          </button>
        ))}
      </nav>
      <OpenByCode controlled={{ open: qr, onClose: () => setQr(false) }} autoScan withoutQr />
    </>
  );
}
