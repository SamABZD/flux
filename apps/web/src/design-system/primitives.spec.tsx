import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, IconButton } from './button';
import { Input } from './input';
import { PasswordInput } from './password-input';
import { MoneyInput } from './money-input';
import { Tabs } from './tabs';
import { Toggle } from './toggle';
import { Modal, BottomSheet } from './modal';
import type { ModalProps } from './modal';

test('loading and disabled actions cannot submit', async () => {
  const click = jest.fn();
  render(
    <>
      <Button onClick={click} loading>
        Saving
      </Button>
      <Button onClick={click} disabled>
        Disabled
      </Button>
      <IconButton label="Refreshing" loading onClick={click}>
        <span>Refresh icon</span>
      </IconButton>
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Saving' }));
  await userEvent.click(screen.getByRole('button', { name: 'Disabled' }));
  await userEvent.click(screen.getByRole('button', { name: 'Refreshing' }));
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
});

test('password visibility remains labeled and is never a submit action', async () => {
  render(<PasswordInput label="Password" defaultValue="example" />);
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  const toggle = screen.getByRole('button', { name: 'Show password' });
  expect(toggle).toHaveAttribute('type', 'button');
  await userEvent.click(toggle);
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('money preserves decimal text and rejects invalid precision', async () => {
  function Example() {
    const [value, setValue] = useState('');
    return <MoneyInput label="Amount" currency="EUR" value={value} onValueChange={setValue} />;
  }
  render(<Example />);
  const input = screen.getByRole('textbox', { name: 'Amount (EUR)' });
  await userEvent.type(input, '12,30');
  expect(input).toHaveValue('12.30');
  await userEvent.type(input, '9abc');
  expect(input).toHaveValue('12.30');
  await userEvent.clear(input);
  await userEvent.type(input, '0.');
  expect(input).toHaveValue('0.');
});

test('tabs support arrow keys and skip disabled options', async () => {
  render(
    <Tabs
      label="Accounts"
      defaultValue="one"
      items={[
        { value: 'one', label: 'Overview', content: 'Overview content' },
        { value: 'disabled', label: 'Unavailable', disabled: true, content: null },
        { value: 'two', label: 'Details', content: 'Details content' },
      ]}
    />,
  );
  screen.getByRole('tab', { name: 'Overview' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Details content');
});

test('switch responds to Space and exposes state', async () => {
  function Example() {
    const [checked, setChecked] = useState(false);
    return <Toggle label="Reminders" checked={checked} onCheckedChange={setChecked} />;
  }
  render(<Example />);
  screen.getByRole('switch', { name: 'Reminders' }).focus();
  await userEvent.keyboard(' ');
  expect(screen.getByRole('switch', { name: 'Reminders' })).toBeChecked();
});

test.each([
  ['Modal', Modal],
  ['BottomSheet', BottomSheet],
] as const)(
  '%s traps keyboard focus, closes on Escape, and restores its trigger',
  async (_name, Component: (props: ModalProps) => React.JSX.Element) => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open example</Button>
          <Component
            open={open}
            onOpenChange={setOpen}
            title="Example"
            description="Focus stays inside."
          >
            <Input label="Name" />
            <Button onClick={() => setOpen(false)}>Done</Button>
          </Component>
        </>
      );
    }
    render(<Example />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open example' });
    await user.click(trigger);
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  },
);
