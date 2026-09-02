import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/layout/navigation";

export const metadata: Metadata = { title: { default: "Space Sales Intelligence", template: "%s · Space Sales Intelligence" }, description: "Inteligência operacional para vendas consultivas." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><Navigation />{children}</body></html>;
}
