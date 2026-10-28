import { useEffect, useRef, useState } from 'react';
import { ImageUpload } from '@maglev/ds';

/** Foto da solicitação: ImageUpload do DS (o mesmo do Novo equipamento) com envio simulado; sem foto é o slot vazio que adiciona a próxima. */
export function PhotoSlot({ label, optional, photo, onChange }: { label: string; optional?: boolean; photo?: { name: string; url: string }; onChange: (p: { name: string; url: string } | null) => void }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  const onFile = (file: File | null) => {
    if (!file) { onChange(null); return; }
    setLoading(true);
    timer.current = window.setTimeout(() => { onChange({ name: file.name, url: URL.createObjectURL(file) }); setLoading(false); }, 600);
  };
  return <ImageUpload label={label} optional={optional} fileName={photo?.name} previewUrl={photo?.url} loading={loading} onChange={onFile} />;
}
