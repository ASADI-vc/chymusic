import type { Metadata } from 'next';
import { QueryProvider } from '@/components/QueryProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'CHYMUSIC Admin',
  description: 'Admin back-office for the CHYMUSIC platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
