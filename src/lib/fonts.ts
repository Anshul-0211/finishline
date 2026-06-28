import { Plus_Jakarta_Sans, Manrope } from "next/font/google";

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-label",
  display: "swap",
});
