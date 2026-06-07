import Spinner from "./Spinner";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

function LoadingState({ message, className = "" }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
    >
      <Spinner size="lg" />
      {message && <p className="text-muted-foreground text-body">{message}</p>}
    </div>
  );
}

export default LoadingState;
