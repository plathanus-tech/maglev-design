import { ReactNode, useEffect, useRef, useState } from 'react';
import { Feedback } from '@maglev/ds';
import { ActionKey, Environment, ScreenKey, SubDb, Unit } from './data';
import { unitIdOfEquipment } from './store';

/**
 * Apoio do módulo Estrutura (RF201-RF204): vínculos de unidades/ambientes (regras de exclusão),
 * rótulos da matriz de permissões e o aviso de formulário com foco no primeiro erro (padrão do Admin `usuario-form.tsx`).
 */

/** Registros ligados a uma unidade (RF202-RGN002): ambientes, equipamentos, solicitações e OS. */
export function unitLinks(db: SubDb, unitId: string) {
  const environments = db.environments.filter((e) => e.unitId === unitId).length;
  const equipments = db.equipments.filter((e) => e.unitId === unitId).length;
  const requests = db.requests.filter((r) => unitIdOfEquipment(db, r.equipmentId) === unitId).length;
  const orders = db.orders.filter((o) => unitIdOfEquipment(db, o.equipmentId) === unitId).length;
  return { environments, equipments, requests, orders, total: environments + equipments + requests + orders };
}

/** Equipamentos ligados a um ambiente (RF203-RGN002). */
export const envEquipmentCount = (db: SubDb, envId: string) => db.equipments.filter((e) => e.environmentId === envId).length;

/** Frase "2 ambientes, 5 equipamentos…" só com o que existe. */
export function linksSentence(l: ReturnType<typeof unitLinks>) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    l.environments && plural(l.environments, 'ambiente', 'ambientes'),
    l.equipments && plural(l.equipments, 'equipamento', 'equipamentos'),
    l.requests && plural(l.requests, 'solicitação', 'solicitações'),
    l.orders && plural(l.orders, 'ordem de serviço', 'ordens de serviço'),
  ].filter(Boolean) as string[];
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts.join('');
}

export const cityUf = (u: Pick<Unit, 'city' | 'uf'>) => [u.city, u.uf].filter(Boolean).join('/') || '-';

/** Unidades que podem ser ofertadas em novos cadastros (RF202-CTA002: inativa não é ofertada). */
export const activeUnits = (db: SubDb, keepId?: string) => db.units.filter((u) => u.status === 'ativo' || u.id === keepId);

export const SCREEN_LABEL: Record<ScreenKey, string> = {
  inicio: 'Início', equipamentos: 'Equipamentos', solicitacoes: 'Solicitações', os: 'Ordens de serviço', planos: 'Planos de manutenção',
  prestadores: 'Prestadores', empresa: 'Empresa', unidades: 'Unidades', ambientes: 'Ambientes', equipe: 'Usuários',
};
export const ACTION_LABEL: Record<ActionKey, string> = {
  visualizar: 'visualizar', cadastrar: 'cadastrar', editar: 'editar', excluir: 'excluir', ativar: 'ativar/inativar',
  aprovar: 'aprovar orçamentos', triar: 'triar solicitações',
};

/** Próximo id de ambiente de uma unidade (ex.: AMB-011 → AMB-017). */
export const nextEnvId = (envs: Environment[]) => {
  const max = envs.reduce((m, e) => Math.max(m, Number(e.id.replace(/\D/g, '')) || 0), 0);
  return `AMB-${String(max + 1).padStart(3, '0')}`;
};

/**
 * Aviso no topo do formulário (mesmo padrão do Admin): só campos vazios → "Preencha os campos obrigatórios";
 * um único erro de outro tipo → só foco; tipos misturados ou vários erros → aviso genérico. Leva o foco ao primeiro erro.
 * `messages` = erros visíveis do render atual; chame `submitted()` ao tentar salvar (depois de `setTried(true)`).
 */
export function useFormFeedback(messages: Array<string | undefined>, scope = 'form') {
  const [banner, setBanner] = useState<'required' | 'multiple' | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(messages);
  latest.current = messages;

  useEffect(() => {
    if (!tick) return;
    const m = latest.current.filter(Boolean) as string[];
    if (!m.length) return;
    const empty = m.filter((x) => /é obrigatório$/.test(x)).length;
    setBanner(m.length === 1 ? null : empty === m.length ? 'required' : 'multiple');
    const first = document.querySelector<HTMLElement>(`${scope} [aria-invalid="true"]`);
    first?.scrollIntoView({ block: 'center' });
    first?.focus({ preventScroll: true });
  }, [tick, scope]);

  const clear = () => setBanner(null);
  const submitted = () => { setBanner(null); setTick((n) => n + 1); };
  const node: ReactNode = banner && (
    <div className="floating-feedback">
      {banner === 'required'
        ? <Feedback type="error" title="Preencha os campos obrigatórios" message="Revise os campos destacados para continuar" dismissible onDismiss={clear} />
        : <Feedback type="error" title="Não foi possível salvar" message="Corrija os campos destacados e tente novamente" dismissible onDismiss={clear} />}
    </div>
  );
  return { node, clear, submitted };
}
