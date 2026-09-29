import type { Preview } from '@storybook/react';
import '../src/tokens/tokens.css';

// Fontes servidas localmente (nenhuma requisição a terceiros — privacidade/LGPD).
// Devem coincidir com --font-display e --font-body em src/tokens/brand.css.
// Ao trocar de identidade: `npm i @fontsource/<fonte>` e troque estas importações.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

function applyTheme(theme: string) {
  document.body.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light / Dark mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun',  title: 'Light' },
          { value: 'dark',  icon: 'moon', title: 'Dark'  },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (StoryFn, context) => {
      applyTheme((context.globals['theme'] as string) ?? 'light');
      return StoryFn();
    },
  ],

  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
    options: {
      // Barra lateral: seções fixas e, dentro delas, componentes em ordem alfabética.
      // Stories do mesmo componente mantêm a ordem do arquivo (Default primeiro).
      // Precisa ser autocontida e sem tipos (o Storybook a avalia isoladamente).
      storySort: (a, b) => {
        if (a.title === b.title) return 0;
        const order = ['Getting Started', 'Foundations', 'Components', 'Patterns'];
        const rank = (t) => { const i = order.indexOf(t.split('/')[0]); return i === -1 ? order.length : i; };
        return rank(a.title) - rank(b.title) || a.title.localeCompare(b.title, 'pt-BR');
      },
    },
  },
};

export default preview;
