import Spinner from "./Spinner";

interface LoadingOverlayProps {
  message?: string;
}

function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Spinner size="lg" />
      {message && <p className="text-darkgray text-sm">{message}</p>}
    </div>
  );
}

export default LoadingOverlay;
