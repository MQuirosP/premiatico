import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Premiático — ¡Más chances, más emoción!',
  description:
    'Elegí tu combo de pases digitales, descubrí tus chances y participá por increíbles premios en Costa Rica.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
