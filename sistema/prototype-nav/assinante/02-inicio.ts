/**
 * Navegador de Protótipo - Área do assinante, jornada "Início" (RF101 - Dashboard operacional / Central do trabalho).
 */
import type { Journey } from '../config';
import { getSubDb, userIdOf } from '../../assinante/shared/store';

const s = 'assinante/screens';
const v = (id: string, label: string, path: string) => ({ id, label, path: `${s}/${path}` });

export const journeys: Journey[] = [
  {
    id: 'assinante-inicio',
    label: 'Início',
    items: [
      {
        id: 'inicio', label: 'RF101 - Início (Central do trabalho)', path: `${s}/inicio.html`,
        variants: [
          v('inicio-empty', 'Sem pendências', 'inicio.html#state=empty'),
          v('inicio-firstaccess', 'Primeiro acesso: canal de avisos (WhatsApp) e telefone', 'inicio.html#state=firstaccess'),
          v('inicio-v1', 'v1 (Início anterior: sem faixa nem cartão em destaque)', 'inicio.html#state=v1'),
          v('inicio-mobile-v1', 'Mobile v1 (cartões completos, versão anterior)', 'inicio.html#state=mobilev1'),
          v('inicio-suspension', 'Aviso de inativação prevista (gestor)', `inicio.html?as=${userIdOf('gestor', getSubDb())}#state=suspension`),
          v('inicio-gestor', 'Perfil Gestor de manutenção', `inicio.html?as=${userIdOf('gestor', getSubDb())}`),
          v('inicio-executor', 'Perfil Executor (só suas OS)', `inicio.html?as=${userIdOf('executor', getSubDb())}`),
        ],
      },
    ],
  },
];
