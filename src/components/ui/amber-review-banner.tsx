import React from "react";
import { AlertTriangle } from "lucide-react";

export interface AmberReviewBannerProps {
  message: string;
}

export const AmberReviewBanner: React.FC<AmberReviewBannerProps> = ({ message }) => {
  return (
    <div
      className="flex items-center gap-3 p-4 bg-error-container border-l-[3px] border-error text-on-error-container rounded-r-lg shadow-sm"
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-error animate-pulse" />
      <span className="text-sm font-medium leading-relaxed font-sans">{message}</span>
    </div>
  );
};

export default AmberReviewBanner;
