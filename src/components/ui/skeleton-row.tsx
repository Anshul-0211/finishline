import React from "react";

export interface SkeletonRowProps {
  className?: string;
  height?: number; // default 64px
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ className = "", height }) => {
  return (
    <div
      style={{
        background: "linear-gradient(to right, var(--skeleton-from), var(--skeleton-to))",
        height: height ?? 64,
      }}
      className={`w-full rounded-xl animate-pulse ${className}`}
    />
  );
};

export default SkeletonRow;
