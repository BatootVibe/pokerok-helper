import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="card card-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {description && <p className="modal-desc">{description}</p>}
        <div className="modal-actions">
          <button
            className={`btn btn-small ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            className="btn btn-secondary btn-small"
            style={{ flex: 1 }}
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
