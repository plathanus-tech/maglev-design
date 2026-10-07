import { DragEvent, useRef, useState } from 'react';
import { IconAlertTriangle, IconPhoto, IconPhotoPlus } from '@tabler/icons-react';
import { cx } from '../../utils/cx';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { Spinner } from '../Spinner/Spinner';
import styles from './ImageUpload.module.css';

export interface ImageUploadLabels {
  add: string;
  replace: string;
  remove: string;
  loading: string;
  /** Mensagem de formato inválido. */
  invalidType: string;
  /** Mensagem de arquivo acima do limite (só usada quando `maxSizeBytes` é informado). */
  tooLarge: string;
}

const DEFAULT_LABELS: ImageUploadLabels = {
  add: 'Adicionar foto',
  replace: 'Trocar foto',
  remove: 'Remover foto',
  loading: 'Enviando foto...',
  invalidType: 'Envie uma imagem JPG ou PNG',
  tooLarge: 'A imagem é maior que o tamanho permitido',
};

export interface ImageUploadProps {
  /** Rótulo visível do campo (também nomeia as ações de trocar/remover). */
  label: string;
  /** Campo opcional: mostra “(opcional)” ao lado do rótulo. */
  optional?: boolean;
  /** Texto auxiliar no estado vazio (ex.: formatos aceitos). */
  helperText?: string;
  /** Nome do arquivo atual; vazio = estado vazio. */
  fileName?: string;
  /** URL da miniatura (ex.: `URL.createObjectURL`). Sem ela, mostra um ícone de imagem no lugar. */
  previewUrl?: string;
  /** Chamado com o arquivo válido escolhido (ou solto) e com `null` ao remover. */
  onChange: (file: File | null) => void;
  /** Aguardando o envio/processamento do arquivo. */
  loading?: boolean;
  /** Erro vindo de fora (ex.: servidor). Erros de formato/tamanho são tratados pelo componente. */
  error?: string;
  disabled?: boolean;
  /** Tipos aceitos no seletor e validados ao soltar. Padrão: JPG e PNG. */
  accept?: string;
  /** Limite de tamanho em bytes. Sem valor, nenhum limite é validado (não invente limite que a regra de negócio não definiu). */
  maxSizeBytes?: number;
  labels?: Partial<ImageUploadLabels>;
  className?: string;
}

/**
 * Upload de uma imagem, compacto: área clicável (e que aceita arrastar e soltar) no estado vazio; com a imagem
 * escolhida mostra miniatura, nome do arquivo e as ações Trocar/Remover. Compõe `FormField`.
 * A cor primária destaca só a ação (ícone e texto); fundo e borda são neutros.
 */
export function ImageUpload({
  label, optional, helperText = 'JPG ou PNG', fileName, previewUrl, onChange, loading = false, error, disabled = false,
  accept = 'image/png,image/jpeg', maxSizeBytes, labels, className,
}: ImageUploadProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const shownError = error ?? localError;
  const hasFile = !!fileName;
  const types = accept.split(',').map((x) => x.trim());

  const pick = () => { if (!disabled && !loading) inputRef.current?.click(); };
  const accepts = (file: File) => types.some((tp) => (tp.endsWith('/*') ? file.type.startsWith(tp.slice(0, -1)) : file.type === tp));
  const take = (file?: File) => {
    if (!file) return;
    if (!accepts(file)) { setLocalError(t.invalidType); return; }
    if (maxSizeBytes && file.size > maxSizeBytes) { setLocalError(t.tooLarge); return; }
    setLocalError(undefined);
    onChange(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && !loading) take(e.dataTransfer.files?.[0]);
  };
  const onDrag = (e: DragEvent, on: boolean) => { e.preventDefault(); if (!disabled && !loading) setDragging(on); };

  return (
    <FormField label={label} optional={optional} error={shownError} hideErrorIcon={false} className={className}>
      {(control) => (
        <>
          <input
            ref={inputRef} type="file" accept={accept} className={styles.input} tabIndex={-1} aria-hidden="true" disabled={disabled}
            onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }}
          />
          {loading ? (
            <div className={cx(styles.box, styles.loading)} aria-busy="true">
              <Spinner size="sm" label={t.loading} />
              <span className={styles.helper}>{t.loading}</span>
            </div>
          ) : hasFile ? (
            <div className={cx(styles.box, styles.filled, disabled && styles.disabled)} role="group" aria-label={label}>
              <span className={styles.thumb}>
                {previewUrl ? <img src={previewUrl} alt="" /> : <IconPhoto size={24} aria-hidden="true" />}
              </span>
              <span className={styles.meta}>
                <span className={styles.name} title={fileName}>{fileName}</span>
                <span className={styles.actions}>
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={pick} aria-label={`${t.replace}: ${label}`}>{t.replace}</Button>
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { setLocalError(undefined); onChange(null); }} aria-label={`${t.remove}: ${label}`}>{t.remove}</Button>
                </span>
              </span>
            </div>
          ) : (
            <button
              {...control}
              type="button"
              className={cx(styles.box, styles.drop, dragging && styles.dragging, shownError && styles.invalid)}
              disabled={disabled}
              onClick={pick}
              onDragEnter={(e) => onDrag(e, true)} onDragOver={(e) => onDrag(e, true)} onDragLeave={(e) => onDrag(e, false)} onDrop={onDrop}
            >
              <span className={styles.icon} aria-hidden="true">{shownError ? <IconAlertTriangle size={24} /> : <IconPhotoPlus size={24} />}</span>
              <span className={styles.texts}>
                <span className={styles.action}>{t.add}</span>
                <span className={styles.helper}>{helperText}</span>
              </span>
            </button>
          )}
        </>
      )}
    </FormField>
  );
}
