/**
 * Atores do Navegador de Protótipo: cada ator é uma "frente" do produto (VISÃO GERAL §1) e muda qual
 * área o usuário está vendo. Só o Navegador conhece isto; não faz parte da interface final.
 * - Admin da plataforma: `config.ts` (admin/screens/*.html).
 * - Assinante: um arquivo por módulo em `prototype-nav/assinante/*.ts` (assinante/screens/*.html), reunidos aqui
 *   pela ordem do nome do arquivo (prefixo numérico: 01-acesso.ts, 02-inicio.ts…).
 * - E-mails transacionais: pré-visualização dos modelos (emails/screens), separada das jornadas; `prototype-nav/emails/*.ts`.
 * - Prestador de serviço (link web) e Colaborador/Solicitante (PWA via QR Code): telas externas, sem login; um arquivo por módulo em
 *   `prototype-nav/prestador/*.ts` e `prototype-nav/colaborador/*.ts` (prestador/screens, colaborador/screens).
 */
import { journeys as adminJourneys, type Journey } from './config';

export type ActorId = 'admin' | 'assinante' | 'prestador' | 'colaborador' | 'emails';
export interface Actor { id: ActorId; label: string; journeys: Journey[]; available: boolean }

const subscriberModules = import.meta.glob<{ journeys: Journey[] }>('./assinante/*.ts', { eager: true });
const subscriberJourneys = Object.keys(subscriberModules).sort().flatMap((k) => subscriberModules[k].journeys);

const providerModules = import.meta.glob<{ journeys: Journey[] }>('./prestador/*.ts', { eager: true });
const providerJourneys = Object.keys(providerModules).sort().flatMap((k) => providerModules[k].journeys);
const requesterModules = import.meta.glob<{ journeys: Journey[] }>('./colaborador/*.ts', { eager: true });
const requesterJourneys = Object.keys(requesterModules).sort().flatMap((k) => requesterModules[k].journeys);

const emailModules = import.meta.glob<{ journeys: Journey[] }>('./emails/*.ts', { eager: true });
const emailJourneys = Object.keys(emailModules).sort().flatMap((k) => emailModules[k].journeys);

export const actors: Actor[] = [
  { id: 'admin', label: 'Admin da plataforma', journeys: adminJourneys, available: true },
  { id: 'assinante', label: 'Assinante', journeys: subscriberJourneys, available: subscriberJourneys.length > 0 },
  { id: 'prestador', label: 'Prestador de serviço (link web)', journeys: providerJourneys, available: providerJourneys.length > 0 },
  { id: 'colaborador', label: 'Colaborador / Solicitante (PWA via QR Code)', journeys: requesterJourneys, available: requesterJourneys.length > 0 },
  { id: 'emails', label: 'E-mails transacionais (pré-visualização)', journeys: emailJourneys, available: emailJourneys.length > 0 },
];
