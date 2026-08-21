import * as Dialog from '@radix-ui/react-dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number
  /** When true the title is visually hidden but still present for screen readers */
  hideTitle?: boolean
}

export function Modal({ open, onClose, title, children, maxWidth, hideTitle }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal"
          style={maxWidth ? { maxWidth } : undefined}
          aria-describedby={undefined}
        >
          <Dialog.Title
            className="modal-title"
            style={hideTitle ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' } : undefined}
          >
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
