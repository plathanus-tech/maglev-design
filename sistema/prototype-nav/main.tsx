import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrototypeNav } from './PrototypeNav';

import '../../../storybook-maglev/src/tokens/tokens.css';
import '../admin/shared/theme';
import '../admin/shared/fonts.css';
import './nav.css';

// O navegador não se renderiza dentro de outro Navegador de Protótipo (se uma navegação do quadro
// cair nele por engano, a barra lateral se repetiria). Só olha o quadro-pai do mesmo site: o painel
// do app também abre páginas em quadros, e isso não conta.
const insideAnotherNavigator = (() => {
  try { return window.parent !== window && !!window.parent.document.querySelector('.pn-root'); } catch { return false; }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {insideAnotherNavigator ? <p>Tela não encontrada. Escolha outra tela no Navegador de Protótipo.</p> : <PrototypeNav />}
  </StrictMode>,
);
