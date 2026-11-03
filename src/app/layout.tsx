import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Life Garden · Compound what matters',
  description: 'A little space for a meaningful life. Your private, local-first life companion.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
