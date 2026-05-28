interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
};

function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} border-primary animate-spin rounded-full border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export default Spinner;
