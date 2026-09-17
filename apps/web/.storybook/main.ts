import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ['../src/design-system/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-webpack5-compiler-swc'],
  framework: { name: '@storybook/react-webpack5', options: {} },
  webpackFinal(config) {
    config.resolve = {
      ...config.resolve,
      alias: { ...config.resolve?.alias, '@': path.resolve(import.meta.dirname, '../src') },
    };
    return config;
  },
};
export default config;
