import type { Preview } from '@storybook/react-webpack5';
import { themes } from 'storybook/theming';
import { TooltipProvider } from '../src/design-system/tooltip';
import { ToastProvider } from '../src/design-system/toast';
import '../src/styles.css';

const preview: Preview = {
  parameters: {
    docs: { theme: themes.dark },
    layout: 'padded',
    backgrounds: { options: { graphite: { name: 'Graphite', value: '#0D0F12' } } },
  },
  initialGlobals: { backgrounds: { value: 'graphite' } },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <ToastProvider>
          <Story />
        </ToastProvider>
      </TooltipProvider>
    ),
  ],
};
export default preview;
