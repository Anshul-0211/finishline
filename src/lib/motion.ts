import { Variants } from "framer-motion";

export const SPRING_FAST = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;

export const SPRING_SMOOTH = {
  type: "spring",
  stiffness: 280,
  damping: 25,
} as const;

export const STAGGER_DELAY = 0.06;

export const FADE_SLIDE: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};
