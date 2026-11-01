import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const CloseCtx = createContext<() => void>(() => {});
/** Chiude il foglio che contiene il componente. */
export const useSheetClose = () => useContext(CloseCtx);

/**
 * Pulsante che apre un foglio modale con il contenuto passato.
 * Il contenuto viene montato solo quando il foglio è aperto (stato del form sempre pulito).
 */
export function SheetTrigger({
  title,
  content,
  children,
  className,
  ariaLabel,
}: {
  title: string;
  content: ReactNode;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={ariaLabel}>
        {children}
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          {content}
        </Sheet>
      )}
    </>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <CloseCtx value={onClose}>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </CloseCtx>,
    document.body,
  );
}
