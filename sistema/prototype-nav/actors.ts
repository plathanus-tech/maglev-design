/**
 * Atores do Navegador de Protótipo: cada ator é uma "frente" do produto (VISÃO GERAL §1) e muda qual
 * área o usuário está vendo. Só o Navegador conhece isto; não faz parte da interface final.
 * - Admin da plataforma: `config.ts` (admin/screens/*.html).
 * - Assinante: um arquivo por módulo em `prototype-nav/assinante/*.ts` (assinante/screens/*.html), reunidos aqui
 *   pela ordem do nome do arquivo (prefixo numérico: 01-acesso.ts, 02-inicio.ts…).
 * - Prestador de serviço e Colaborador/Solicitante (PWA): ainda não prototipados (aparecem desabilitados).
 */
import { journeys as adminJourneys, type Journey } from './config';

export type ActorId = 'admin' | 'assinante' | 'prestador' | 'colaborador';
export interface Actor { id: ActorId; label: string; journeys: Journey[]; available: boolean }

const subscriberModules = import.meta.glob<{ journeys: Journey[] }>('./assinante/*.ts', { eager: true });
const subscriberJourneys = Object.keys(subscriberModules).sort().flatMap((k) => subscriberModules[k].journeys);

export const actors: Actor[] = [
  { id: 'admin', label: 'Admin da plataforma', journeys: adminJourneys, available: true },
  { id: 'assinante', label: 'Assinante', journeys: subscriberJourneys, available: subscriberJourneys.length > 0 },
  { id: 'prestador', label: 'Prestador de serviço (em breve)', journeys: [], available: false },
  { id: 'colaborador', label: 'Colaborador / Solicitante PWA (em breve)', journeys: [], available: false },
];
