import './globals.css';

export const metadata = {
  title: 'WebContainer IDE',
  description: 'Browser-based Next.js IDE powered by WebContainers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
