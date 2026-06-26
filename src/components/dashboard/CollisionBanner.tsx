"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface CollisionAlert {
  id: string;
  commitmentAId: string;
  commitmentBId: string;
  commitmentATitle: string;
  commitmentBTitle: string;
  severity: string;
  read: boolean;
  createdAt: any;
}

interface CollisionBannerProps {
  alerts: CollisionAlert[];
  onDismiss: (alertId: string) => Promise<void>;
}

export default function CollisionBanner({ alerts, onDismiss }: CollisionBannerProps) {
  // Show only unread collision alerts
  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <div className="w-full">
      <AnimatePresence mode="popLayout">
        {unreadAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mb-4 bg-gradient-to-r from-red-950/20 to-amber-950/20 border border-red-500/30 hover:border-red-500/50 rounded-2xl p-4 flex items-start gap-3 shadow-md backdrop-blur-md"
          >
            {/* Warning icon */}
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            {/* Content text */}
            <div className="flex-1 min-w-0 text-sm">
              <h4 className="font-bold text-red-400">Scheduling collision detected</h4>
              <p className="text-[#F0B429] mt-0.5 font-medium">
                &ldquo;{alert.commitmentATitle}&rdquo; and &ldquo;{alert.commitmentBTitle}&rdquo; share overlapping work blocks.
              </p>
              <p className="text-xs text-[#8B949E] mt-1.5">
                This overlap increases risk scores across conflicting tasks. Consider renegotiating deadlines or updating scheduled times.
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 text-[#8B949E] hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer shrink-0"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
