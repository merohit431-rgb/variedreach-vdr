import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InsolvencyVDR',
  description: 'Virtual Data Room platform for IBC insolvency professionals',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
