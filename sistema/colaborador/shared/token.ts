/**
 * Identificador público de acompanhamento (RF004 do Colaborador): o link da solicitação usa este token, nunca só o número do protocolo.
 * PROTÓTIPO: derivado do protocolo por uma mistura fixa, só para que o mesmo link funcione sempre sem backend. Em produção o token deve ser
 * aleatório (ex.: 128 bits), gerado no servidor ao criar a solicitação e guardado no registro; a URL pública deve ser a do ambiente real.
 * 💡 Pendente de validação: política de validade/expiração do link (nenhuma foi definida; aqui o link não expira).
 */
export function publicTokenOf(id: string): string {
  const mix = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    const s = `maglev-acompanhar:${id}`;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
  };
  return `${mix(1)}${mix(7)}`;
}

/** Link de acompanhamento por token (relativo à tela de acompanhar). */
export const linkToRequestByToken = (id: string) => `acompanhar.html?t=${publicTokenOf(id)}`;
