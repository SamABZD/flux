import {
  House,
  ArrowsLeftRight,
  ChartBar,
  CreditCard,
  Wallet,
  Receipt,
  Target,
  Repeat,
  GearSix,
  SquaresFour,
  Pulse,
} from '@phosphor-icons/react';

export const destinations = [
  { path: '/home', label: 'Home', icon: House, description: 'Your money, in focus.' },
  {
    path: '/payments',
    label: 'Payments',
    icon: ArrowsLeftRight,
    description: 'For the everyday and the unexpected.',
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: ChartBar,
    description: 'See the story behind your spending.',
  },
  {
    path: '/cards',
    label: 'Cards',
    icon: CreditCard,
    description: 'Made for wherever life takes you.',
  },
  {
    path: '/accounts',
    label: 'Accounts',
    icon: Wallet,
    description: 'A home for every part of your money.',
  },
  {
    path: '/transactions',
    label: 'Transactions',
    icon: Receipt,
    description: 'Every detail, all in one place.',
  },
  {
    path: '/budgets',
    label: 'Budgets',
    icon: Target,
    description: 'Give your plans a little more room.',
  },
  {
    path: '/subscriptions',
    label: 'Subscriptions',
    icon: Repeat,
    description: 'Keep the recurring things in view.',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: GearSix,
    description: 'Make this space feel like yours.',
  },
  {
    path: '/design-system',
    label: 'Design system',
    icon: SquaresFour,
    description: 'The details that bring Flux together.',
  },
  {
    path: '/diagnostics',
    label: 'Diagnostics',
    icon: Pulse,
    description: 'Check the connection behind the interface.',
  },
] as const;
export const primaryDestinations = destinations.slice(0, 4);
export const workspaceDestinations = [destinations[0], ...destinations.slice(4, 8)];
