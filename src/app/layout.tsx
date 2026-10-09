import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./workspace.css";
import "./builder.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Lora({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "WebWrite",
  description: "Humanities homework with guided feedback from Jev.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
