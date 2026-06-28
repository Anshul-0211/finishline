import React from "react";

export interface ProgressBarProps {
  percentage: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, className = "" }) => {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div className={`w-full h-1 bg-surface-container rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
};

export default ProgressBar;
