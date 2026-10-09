"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Small popup on top of a dimmed page (native <dialog>: focus trap and Esc for free).
 * Children only mount while open, so forms start fresh each time.
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="modal-body">
          <header className="modal-header">
            <h2 id="modal-title">{title}</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
