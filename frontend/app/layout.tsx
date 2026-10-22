import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Matches font.family.body/heading ("Inter") from the Figma tokens.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SSICSIM · Committee tools",
  description: "Committee crisis tracking and Pokémon battle generation."
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="min-h-screen">
        <Providers>
          <TooltipProvider>
            <Navbar />
            {props.children}
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
