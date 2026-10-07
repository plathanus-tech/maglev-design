import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ImageUpload } from './ImageUpload';

const meta: Meta<typeof ImageUpload> = {
  title: 'Components/ImageUpload',
  component: ImageUpload,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component:
          'Upload de uma imagem, compacto. Vazio: área clicável (aceita arrastar e soltar) com ícone, “Adicionar foto” e o formato aceito. Com imagem: miniatura, nome do arquivo e ações Trocar/Remover. A cor primária destaca só a ação; fundo e borda são neutros. Compõe `FormField`. Não valida limite de tamanho a menos que `maxSizeBytes` seja informado.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ImageUpload>;

/** Controlado com estado local: escolhe o arquivo, mostra “enviando” por instantes e depois a miniatura. */
function Live(props: Partial<React.ComponentProps<typeof ImageUpload>>) {
  const [file, setFile] = useState<{ name: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <ImageUpload
      label="Foto do equipamento" optional {...props}
      fileName={file?.name} previewUrl={file?.url} loading={loading}
      onChange={(f) => {
        if (!f) { setFile(null); return; }
        setLoading(true);
        window.setTimeout(() => { setFile({ name: f.name, url: URL.createObjectURL(f) }); setLoading(false); }, 700);
      }}
    />
  );
}

export const Empty: Story = { render: () => <Live /> };
export const Loading: Story = { args: { label: 'Foto do equipamento', optional: true, loading: true, onChange: () => undefined } };
export const WithImage: Story = {
  args: {
    label: 'Foto do equipamento', optional: true, fileName: 'freezer-horizontal.jpg', onChange: () => undefined,
    previewUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23cbd5e1"/><circle cx="22" cy="24" r="8" fill="%2394a3b8"/><path d="M0 64 24 36 40 52 52 40 64 54V64Z" fill="%2394a3b8"/></svg>',
  },
};
export const FileWithoutPreview: Story = { args: { label: 'Foto da etiqueta ou placa', optional: true, fileName: 'etiqueta.png', onChange: () => undefined } };
export const Error: Story = { args: { label: 'Foto do equipamento', optional: true, error: 'Envie uma imagem JPG ou PNG', onChange: () => undefined } };
export const Disabled: Story = { args: { label: 'Foto do equipamento', optional: true, disabled: true, onChange: () => undefined } };
export const DisabledWithImage: Story = { args: { label: 'Foto do equipamento', optional: true, disabled: true, fileName: 'freezer-horizontal.jpg', onChange: () => undefined } };
export const TwoSideBySide: Story = {
  decorators: [(Story) => <div style={{ width: 720 }}><Story /></div>],
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Live label="Foto do equipamento" />
      <Live label="Foto da etiqueta ou placa" />
    </div>
  ),
};
