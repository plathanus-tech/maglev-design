import type { Meta, StoryObj } from '@storybook/react';
import { IconCalendarRepeat, IconCooker, IconMessageReport, IconReportMoney, IconUserCheck, IconUserExclamation } from '@tabler/icons-react';
import { KpiCard } from './KpiCard';

const meta: Meta<typeof KpiCard> = {
  title: 'Components/KpiCard',
  component: KpiCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Indicador compacto para dashboards. O comparativo (`trend`) é opcional e só deve aparecer quando houver ' +
          'histórico real da métrica. A cor do comparativo vem de `trend.sentiment` (bom/ruim para aquele KPI), nunca da seta: ' +
          'inadimplentes subindo é `negative`; chamados abertos caindo é `positive`.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 'calc(var(--spacing-3xl) * 4.5)' }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {
  args: { label: 'Assinantes ativos', value: 128, icon: <IconUserCheck size={20} /> },
};

export const WithPositiveTrend: Story = {
  args: {
    label: 'Assinantes ativos', value: 128, icon: <IconUserCheck size={20} />,
    trend: { direction: 'up', percent: 4.1, sentiment: 'positive', reference: 'vs. 7 dias anteriores' },
  },
};

/** Aumento que é ruim para a métrica: seta para cima, cor de erro. */
export const IncreaseIsNegative: Story = {
  args: {
    label: 'Clientes inadimplentes', value: 6, icon: <IconUserExclamation size={20} />,
    trend: { direction: 'up', percent: 20, sentiment: 'negative', reference: 'vs. 7 dias anteriores' },
  },
};

/** Redução que é boa para a métrica: seta para baixo, cor de sucesso. */
export const DecreaseIsPositive: Story = {
  args: {
    label: 'Solicitações abertas', value: 23, icon: <IconMessageReport size={20} />,
    trend: { direction: 'down', percent: 8, sentiment: 'positive', reference: 'vs. ontem' },
  },
};

export const NoChange: Story = {
  args: {
    label: 'Equipamentos cadastrados', value: 1876, icon: <IconCooker size={20} />,
    trend: { direction: 'flat', percent: 0, sentiment: 'neutral', reference: 'vs. ontem' },
  },
};

/** Métrica sem histórico adequado: só o valor atual. */
export const WithoutTrend: Story = {
  args: { label: 'Preventivas cadastradas', value: 214, icon: <IconCalendarRepeat size={20} /> },
};

/** Valor em texto + descrição complementar (ex.: cliente com mais solicitações). */
export const TextValueWithDescription: Story = {
  args: {
    label: 'Cliente com mais solicitações', value: 'Cantina Dona Rosa', icon: <IconMessageReport size={20} />,
    description: '38 solicitações nos últimos 30 dias',
  },
};

/** Valor monetário: mesmo tamanho dos demais valores. */
export const Currency: Story = {
  args: { label: 'Valor total gasto em manutenção', value: 'R$ 2.205.737,00', icon: <IconReportMoney size={20} /> },
};

/** Ranking compacto (top 3): linhas do mesmo nível, menores que o label; nomes só truncam quando não cabem. */
export const Ranking: Story = {
  args: {
    label: 'Clientes com mais solicitações', icon: <IconMessageReport size={20} />,
    ranking: [
      { label: 'Cantina Dona Rosa', value: 38 },
      { label: 'Bistrô Alecrim', value: 31 },
      { label: 'Sushi Kaze Culinária Japonesa e Eventos', value: 27 },
    ],
  },
};
