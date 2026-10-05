import { onlyDigits } from './format';

export interface CepResult { street: string; district: string; city: string; uf: string }

/** Consulta de CEP no ViaCEP (https://viacep.com.br, gratuito e sem chave). `null` = CEP não existe; lança em falha de rede. */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepResult | null> {
  const d = onlyDigits(cep);
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal });
  if (!res.ok) throw new Error(`ViaCEP ${res.status}`);
  const data = await res.json();
  if (data.erro) return null;
  return { street: data.logradouro ?? '', district: data.bairro ?? '', city: data.localidade ?? '', uf: data.uf ?? '' };
}

