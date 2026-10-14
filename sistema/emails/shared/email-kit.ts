/**
 * Base dos e-mails transacionais da Maglev. Todos os templates (nova OS, convite, recuperação de senha, notificações) montam o
 * e-mail com estas peças, para manter uma só identidade: logo centralizado acima do card branco, fundo externo cinza-claro, botão
 * primário laranja e rodapé discreto.
 *
 * HTML de e-mail: tabelas + estilos inline, 600px no máximo e fluido no celular. Sem CSS externo, sem fontes web obrigatórias e sem
 * componentes do Storybook (os clientes de e-mail não os renderizam). As cores são os valores dos tokens do produto resolvidos para
 * hexadecimal (ex.: botão = `--color-action-primary` com texto `--color-on-action-primary`, como o botão primário do produto).
 *
 * Variáveis para integração futura (nada é disparado no protótipo): cada template recebe os valores e os links por parâmetro;
 * a pré-visualização mostra também a versão com marcadores `{{variavel}}`. O logo precisa de uma URL pública em PNG.
 */
export const C = {
  action: '#FA8D3D', onAction: '#051730', page: '#F5F5F4', surface: '#FFFFFF', panel: '#FAFAF9', line: '#EFEDEC',
  border: '#E7E5E4', text: '#1B1918', textSecondary: '#46413F', textTertiary: '#5B5552', link: '#BA5303',
};
export const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Marcadores {{variavel}} usados na versão "com variáveis" da pré-visualização */
export const ph = (name: string) => `{{${name}}}`;

export type PillTone = 'error' | 'warning' | 'info' | 'success' | 'neutral';
const PILL: Record<PillTone, { fg: string; bg: string }> = {
  error: { fg: '#B91C2E', bg: '#FEF2F3' }, warning: { fg: '#BA5303', bg: '#FFFBED' }, info: { fg: '#1D4ED8', bg: '#EFF6FF' },
  success: { fg: '#157347', bg: '#EDFAF3' }, neutral: { fg: '#46413F', bg: '#F5F5F4' },
};
/** Etiqueta com ponto, nas cores semânticas dos badges do produto (não parece link) */
export const pill = (label: string, tone: PillTone) =>
  `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${PILL[tone].bg};color:${PILL[tone].fg};font-size:13px;line-height:20px;font-weight:600;">&#9679;&nbsp;${esc(label)}</span>`;

/** Título do e-mail */
export const heading = (text: string) =>
  `<tr><td style="font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${C.text};padding-bottom:12px;">${esc(text)}</td></tr>`;

/** Parágrafo(s) de texto; `html` já vem escapado/formatado por quem chama */
export const paragraph = (html: string, bottom = 24) =>
  `<tr><td style="font-family:${FONT};font-size:15px;line-height:24px;color:${C.textSecondary};padding-bottom:${bottom}px;">${html}</td></tr>`;

export interface SummaryRow { label: string; /** HTML já escapado (use `esc`) */ value: string }
/** Bloco de resumo em duas colunas (rótulo à esquerda, valor à direita) */
export const summary = (rows: SummaryRow[]) => {
  const cells = rows.map((r, i) => {
    const border = i === rows.length - 1 ? '' : `border-bottom:1px solid ${C.line};`;
    return `
              <tr>
                <td style="padding:10px 0;${border}font-family:${FONT};font-size:13px;line-height:18px;color:${C.textTertiary};width:36%;vertical-align:top;">${esc(r.label)}</td>
                <td style="padding:10px 0 10px 12px;${border}font-family:${FONT};font-size:15px;line-height:22px;color:${C.text};vertical-align:top;">${r.value}</td>
              </tr>`;
  }).join('');
  return `<tr><td style="background:${C.panel};border-radius:8px;padding:6px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}
                    </table></td></tr>`;
};

/** Botão primário de largura total (mesmas cores do botão primário do produto) */
export const button = (href: string, label: string) => `
                <tr>
                  <td align="center" style="padding:28px 0 8px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                        <td align="center" bgcolor="${C.action}" style="border-radius:8px;">
                          <a href="${href}" target="_blank" style="display:block;padding:14px 24px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;color:${C.onAction};text-decoration:none;border-radius:8px;">${esc(label)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

/** Link textual discreto, centralizado */
export const textLink = (href: string, label: string) =>
  `<tr><td align="center" style="padding-top:12px;font-family:${FONT};font-size:14px;line-height:20px;"><a href="${href}" target="_blank" style="color:${C.link};text-decoration:underline;">${esc(label)}</a></td></tr>`;

/** Observação pequena e discreta (validade, "ignore este e-mail"…) */
export const note = (text: string, top = 16) =>
  `<tr><td align="center" style="padding-top:${top}px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.textTertiary};">${text}</td></tr>`;

/** Código de verificação em destaque */
export const codeBox = (code: string) =>
  `<tr><td align="center" style="padding:4px 0 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td align="center" style="background:${C.panel};border-radius:8px;padding:20px 12px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${C.text};">${esc(code)}</td></tr></table></td></tr>`;

export interface EmailShell {
  /** Título da janela / assunto */
  title: string;
  /** Texto de pré-visualização que o cliente de e-mail mostra ao lado do assunto */
  preheader: string;
  /** Linhas (<tr>…</tr>) do card, na ordem de exibição */
  rows: string[];
  logoUrl: string;
  /** Rodapé; padrão: aviso de e-mail automático */
  footer?: string;
}

/** Estrutura comum: fundo cinza, logo centralizado, card branco e rodapé */
export function emailLayout(s: EmailShell): string {
  const footer = s.footer ?? 'Este é um e-mail automático da Maglev. Não é necessário responder.';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(s.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(s.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <img src="${s.logoUrl}" alt="MAGLEV" height="36" style="display:block;margin:0 auto;border:0;height:36px;width:auto;">
            </td>
          </tr>
          <tr>
            <td style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${s.rows.join('\n                ')}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 12px 0 12px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.textTertiary};">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
