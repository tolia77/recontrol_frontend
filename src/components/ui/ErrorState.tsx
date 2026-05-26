import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Retry', className = '' }: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 gap-3 text-center ${className}`}
    >
      <p className="text-sm text-error">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
