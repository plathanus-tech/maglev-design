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
          v('inicio-gestor', 'Perfil Gestor de manutenção', `inicio.html?as=${userIdOf('gestor', getSubDb())}`),
          v('inicio-executor', 'Perfil Executor (só suas OS)', `inicio.html?as=${userIdOf('executor', getSubDb())}`),
        ],
      },
    ],
  },
];
