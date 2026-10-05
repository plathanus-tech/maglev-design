import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { Plugin } from 'vite';

// Protótipo v2 - Jornada do Admin da plataforma.
// Fonte da verdade: o Storybook na raiz deste repositório (../src). Componentes, tokens e ícones são importados de lá -
// nunca copiados. As dependências (React, Tabler) vêm do node_modules da raiz (instância única de React).
const sb = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Telas do produto (uma entrada por tela). Registrar também em prototype-nav/config.ts. */
export const SCREENS = [
  'login', 'recuperar-senha', 'codigo-verificacao', 'criar-nova-senha',
  'dashboard',
  'assinantes', 'assinante', 'assinante-form',
  'usuarios', 'usuario', 'usuario-form',
  'perfis', 'perfil-form',
  'configuracoes-categorias', 'configuracoes-tipos-solicitacao', 'configuracoes-tipos-manutencao',
  'configuracoes-prioridades', 'configuracoes-criticidades', 'configuracoes-status',
];

/**
 * Tela inexistente em /admin/screens/ responde 404. Sem isto o Vite devolve o index.html (o próprio
 * Navegador de Protótipo) e ele aparece dentro do quadro, repetindo a barra lateral.
 */
const screenNotFound = (): Plugin => ({
  name: 'maglev-screen-not-found',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent((req.url ?? '').split('?')[0].split('#')[0]);
      if (path.startsWith('/admin/screens/') && path.endsWith('.html') && !existsSync(here(`.${path}`))) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><meta charset="utf-8"><title>Tela não encontrada</title><p>Tela não encontrada. Escolha outra tela no Navegador de Protótipo.</p>');
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  root: here('.'),
  // Cache de dependências por instância: vários servidores (v1, v2, outras sessões) no mesmo
  // node_modules/.vite reotimizam entre si e geram React duplicado ("Invalid hook call").
  cacheDir: here(`../node_modules/.vite-v2-${process.env.PORT || '5176'}`),
  plugins: [react(), screenNotFound()],
  resolve: {
    alias: {
      '@maglev/ds': sb('src/index.ts'),
      '@tabler/icons-react': sb('node_modules/@tabler/icons-react'),
      react: sb('node_modules/react'),
      'react-dom': sb('node_modules/react-dom'),
    },
  },
  // Porta atribuída pelo ambiente (PORT) quando houver; senão 5176.
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5176, strictPort: true, fs: { allow: ['..'] } },
  build: {
    outDir: here('dist'),
    rollupOptions: {
      input: {
        ...Object.fromEntries(SCREENS.map((n) => [n, here(`./admin/screens/${n}.html`)])),
        nav: here('./index.html'),
      },
    },
  },
});
