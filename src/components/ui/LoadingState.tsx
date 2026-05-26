import { Spinner } from './Spinner';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className = '' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-3 ${className}`}>
      <Spinner size="lg" />
      {message && <p className="text-sm text-darkgray">{message}</p>}
    </div>
  );
}
