import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Button } from '../Button/Button';

const meta: Meta<typeof Tooltip> = { title: 'Components/Tooltip', component: Tooltip, tags: ['autodocs'],
  decorators: [(S) => <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><S /></div>] };
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = { args: { content: 'Dica acima', placement: 'top', children: <Button variant="secondary">Passe o mouse</Button> } };
export const Bottom: Story = { args: { content: 'Dica abaixo', placement: 'bottom', children: <Button variant="secondary">Passe o mouse</Button> } };
export const Left: Story = { args: { content: 'Dica à esquerda', placement: 'left', children: <Button variant="secondary">Passe o mouse</Button> } };
export const Right: Story = { args: { content: 'Dica à direita', placement: 'right', children: <Button variant="secondary">Passe o mouse</Button> } };
export const AllPlacements: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: 60 }}>
      <Tooltip content="Topo" placement="top"><Button size="sm">Top</Button></Tooltip>
      <Tooltip content="Direita" placement="right"><Button size="sm">Right</Button></Tooltip>
      <Tooltip content="Esquerda" placement="left"><Button size="sm">Left</Button></Tooltip>
      <Tooltip content="Baixo" placement="bottom"><Button size="sm">Bottom</Button></Tooltip>
    </div>
  ),
};
