import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  // Sem telemetria/avisos externos (privacidade).
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  // Se o Storybook for publicado em subcaminho (ex.: GitHub Pages),
  // defina STORYBOOK_BASE=/meu-projeto/ no build.
  viteFinal: async (config) => {
    if (process.env.STORYBOOK_BASE) config.base = process.env.STORYBOOK_BASE;
    return config;
  },
};
export default config;
