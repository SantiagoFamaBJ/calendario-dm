import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendario Dental Medrano",
  description: "Calendario de actividades comerciales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
