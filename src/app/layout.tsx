import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curso de Capacitación | C.E.A. Martha Mendoza",
  description: "Sistema de inscripción y gestión de participantes del Curso de Capacitación - Centro de Educación Alternativa Martha Mendoza, Sucre - Bolivia.",
  keywords: "Curso de Capacitación, CEA Martha Mendoza, Sucre, Bolivia, Inscripciones, Formación Continua",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo-cee.png" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
