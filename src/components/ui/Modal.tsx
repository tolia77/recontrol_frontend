import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "full";
  suppressEsc?: boolean;
  suppressOverlayClick?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

interface SubProps {
  children: ReactNode;
  className?: string;
}

const sizeCardClasses: Record<"sm" | "md" | "lg" | "full", string> = {
  sm: "bg-background border border-lightgray rounded-lg shadow-xl max-w-sm w-[90%] p-6",
  md: "bg-background border border-lightgray rounded-lg shadow-xl max-w-md w-[90%] p-6",
  lg: "bg-background border border-lightgray rounded-lg shadow-xl max-w-lg w-[90%] p-6",
  full: "bg-background w-full max-w-5xl",
};

const wrapperClasses: Record<"sm" | "md" | "lg" | "full", string> = {
  sm: "flex items-center justify-center",
  md: "flex items-center justify-center",
  lg: "flex items-center justify-center",
  full: "",
};

export function Modal({
  open,
  onClose,
  size = "md",
  suppressEsc = false,
  suppressOverlayClick = false,
  initialFocusRef,
  className = "",
  children,
}: ModalProps) {
  const headingId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);

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
    <div
      className={`fixed inset-0 z-50 bg-black/40 ${wrapperClasses[size]}`}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={cardRef}
        className={`${sizeCardClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        data-modal-heading-id={headingId}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ children, className = "" }: SubProps) {
  return (
    <h2 className={`text-text mb-3 text-lg font-semibold ${className}`}>
      {children}
    </h2>
  );
}

function ModalBody({ children, className = "" }: SubProps) {
  return (
    <div className={`text-text/80 mb-4 text-sm ${className}`}>{children}</div>
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
