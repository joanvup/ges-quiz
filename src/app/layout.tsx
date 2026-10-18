import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'QuizColegio',
    template: '%s | QuizColegio',
  },
  description:
    'Sistema de gestion y aplicacion de quices para colegios: crea quices a partir de PDFs y evalua a tus estudiantes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
