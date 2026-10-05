import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { IconFilter } from '@tabler/icons-react';
import { Popover } from './Popover';
import { Button } from '../Button/Button';
import { Dropdown } from '../Dropdown/Dropdown';
import { Stack } from '../Stack/Stack';

const meta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  decorators: [(S) => <div style={{ minHeight: 360, display: 'flex', justifyContent: 'flex-end' }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof Popover>;

export const Filters: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('todos');
    const ref = useRef<HTMLSpanElement>(null);
    return (
      <>
        <span ref={ref}><Button variant="outline" iconLeft={<IconFilter size={16} />} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Filtros</Button></span>
        <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} label="Filtros">
          <Stack gap="md">
            <Dropdown label="Status" options={[{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} value={status} onChange={setStatus} />
            <Stack direction="horizontal" justify="end" gap="sm">
              <Button size="sm" variant="secondary" onClick={() => { setStatus('todos'); setOpen(false); }}>Limpar</Button>
              <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
            </Stack>
          </Stack>
        </Popover>
      </>
    );
  },
};
