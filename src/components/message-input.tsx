"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";

export interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
}) => {
  const [value, setValue] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !value.trim()) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const isSendDisabled = disabled || !value.trim();

  return (
    <form
      onSubmit={handleSend}
      className="bg-surface-container-lowest border-t border-outline-variant px-4 py-3 sticky bottom-0 flex items-center gap-3 w-full transition-colors duration-200 z-10"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="bg-surface-container-low border border-outline-variant rounded-full h-[44px] px-4 text-on-surface font-sans text-[16px] placeholder-text-outline flex-1 outline-none focus:border-primary transition-colors duration-200 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isSendDisabled}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition duration-200 flex-shrink-0 outline-none
          ${
            isSendDisabled
              ? "bg-surface-dim text-on-surface/30 cursor-not-allowed pointer-events-none"
              : "bg-primary text-on-primary hover:bg-primary-container active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
          }`}
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </form>
  );
};

export default MessageInput;
