import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import * as styles from './Dropzone.css';

interface DropzoneProps {
  id?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** texto principal (call-to-action) — default "Arraste os arquivos aqui" */
  label?: string;
  /** texto secundário, ex.: formatos aceitos — opcional */
  hint?: string;
  onFilesSelected: (files: FileList | null) => void;
}

/**
 * Área de upload por clique OU arrastar-e-soltar. Não tem primitivo Radix
 * (não existe um "Radix Dropzone") — o comportamento é HTML5 nativo
 * (dragover/drop + um <input type="file"> visualmente oculto, mas mantido
 * no DOM e focável, para acessibilidade e para funcionar com <Label htmlFor>
 * como os outros campos do @fronteira-ui).
 */
export function Dropzone({
  id,
  accept,
  multiple,
  disabled,
  label = 'Arraste os arquivos aqui',
  hint,
  onFilesSelected,
}: DropzoneProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    onFilesSelected(e.dataTransfer.files);
  }

  const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      data-disabled={disabled ? 'true' : undefined}
      className={cx(styles.root, isDragging && styles.dragging)}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <UploadCloud size={28} className={styles.icon} />
      <span className={styles.label}>{label}</span>
      <span className={styles.sub}>ou clique para selecionar</span>
      {hint ? <span className={styles.sub}>{hint}</span> : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        className={styles.hiddenInput}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onFilesSelected(e.target.files)}
      />
    </div>
  );
}
