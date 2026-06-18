import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useMobileDetect } from "src/hooks/useMobileDetect";

const ModalHeadingContext = createContext<string>("");

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "full";
  suppressEsc?: boolean;
  suppressOverlayClick?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

interface SubProps {
  children: ReactNode;
  className?: string;
}

const sizeCardClasses: Record<"sm" | "md" | "lg" | "full", string> = {
  sm: "bg-surface border border-border rounded-lg shadow-modal max-w-sm w-[90%] p-6",
  md: "bg-surface border border-border rounded-lg shadow-modal max-w-md w-[90%] p-6",
  lg: "bg-surface border border-border rounded-lg shadow-modal max-w-lg w-[90%] p-6",
  full: "bg-surface border border-border rounded-lg shadow-modal w-full max-w-5xl max-h-[90dvh] overflow-y-auto",
};

const wrapperClasses: Record<"sm" | "md" | "lg" | "full", string> = {
  sm: "flex items-center justify-center",
  md: "flex items-center justify-center",
  lg: "flex items-center justify-center",
  full: "flex items-center justify-center p-4",
};

function Modal({
  open,
  onClose,
  size = "md",
  suppressEsc = false,
  suppressOverlayClick = false,
  initialFocusRef,
  className = "",
  ariaLabel,
  children,
}: ModalProps) {
  const isMobile = useMobileDetect();
  const headingId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);

  // Mobile bottom-sheet class overrides
  const mobileWrapperClasses = "flex items-end justify-center";
  const mobileCardClasses =
    "bg-surface border-t border-border rounded-t-lg shadow-modal w-full max-h-[90dvh] overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] animate-slide-up";

  const effectiveWrapperClass = isMobile ? mobileWrapperClasses : wrapperClasses[size];
  const effectiveCardClass = isMobile ? mobileCardClasses : sizeCardClasses[size];

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !suppressEsc) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, suppressEsc, onClose]);

  // Focus management
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const target = initialFocusRef?.current ?? cardRef.current;
    if (target) {
      (target as HTMLElement).focus();
    }
    return () => {
      if (prevFocusRef.current) {
        (prevFocusRef.current as HTMLElement).focus?.();
      }
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (suppressOverlayClick) return;
    onClose();
  };

  return (
    <ModalHeadingContext.Provider value={headingId}>
      <div
        className={`fixed inset-0 z-50 bg-black/40 ${effectiveWrapperClass}`}
        onClick={handleOverlayClick}
        role="presentation"
      >
        <div
          ref={cardRef}
          className={`${effectiveCardClass} ${className}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          {...(ariaLabel
            ? { "aria-label": ariaLabel }
            : { "aria-labelledby": headingId })}
          tabIndex={-1}
          data-modal-heading-id={headingId}
        >
          {children}
        </div>
      </div>
    </ModalHeadingContext.Provider>
  );
}

function ModalHeader({ children, className = "" }: SubProps) {
  const headingId = useContext(ModalHeadingContext);
  return (
    <h2
      id={headingId}
      className={`text-foreground mb-3 text-heading font-semibold ${className}`}
    >
      {children}
    </h2>
  );
}

function ModalBody({ children, className = "" }: SubProps) {
  return (
    <div className={`text-foreground/80 mb-4 text-body ${className}`}>{children}</div>
  );
}

function ModalFooter({ children, className = "" }: SubProps) {
  return (
    <div className={`flex justify-end gap-2 ${className}`}>{children}</div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
