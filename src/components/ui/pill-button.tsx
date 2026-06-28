import React from "react";
import { Loader2 } from "lucide-react";

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  loading?: boolean;
}

const VARIANT_STYLES: Record<"primary" | "outline" | "ghost", string> = {
  primary: "h-[52px] bg-primary text-on-primary hover:bg-primary-container disabled:bg-primary/50 disabled:cursor-not-allowed",
  outline: "h-[48px] border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "bg-transparent border-none text-primary hover:text-primary-container disabled:opacity-50 disabled:cursor-not-allowed px-0",
};

export const PillButton: React.FC<PillButtonProps> = ({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  type = "button",
  ...props
}) => {
  const isButtonDisabled = disabled || loading;
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      className={`inline-flex items-center justify-center font-sans font-semibold px-6 transition duration-200 focus-ring rounded-full active:scale-[0.98] ${variantClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className={`w-5 h-5 animate-spin ${variant === "primary" ? "text-on-primary" : "text-primary"}`} />
      ) : (
        children
      )}
    </button>
  );
};

export default PillButton;
