import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Button } from './button';
import {
  ActionExamples,
  FieldExamples,
  SelectionExamples,
  OverlayExamples,
  FeedbackExamples,
} from './examples';

const meta = {
  title: 'Flux/Visual foundation',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Graphite + Mint Green. Self-hosted Geist, 4px spacing scale, 44px minimum touch targets, and 150–250ms state transitions. Use Tab for focus, arrows between tabs, and Escape to close dialogs. Enable reduced motion at OS level to remove transitions.',
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Actions: Story = { render: () => <ActionExamples /> };
export const Inputs: Story = { render: () => <FieldExamples /> };
export const SelectionAndIdentity: Story = { render: () => <SelectionExamples /> };
export const DialogsAndFeedback: Story = { render: () => <OverlayExamples /> };
export const LoadingEmptyAndError: Story = { render: () => <FeedbackExamples /> };
