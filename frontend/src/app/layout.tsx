import './globals.css';
import { Inter } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-brand-600 to-teal-500 text-white">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6V3Z" />
                </svg>
              </span>
              <span className="font-semibold text-ink">PanaNexus</span>
              <span className="hidden sm:inline">— Connected healthcare. Faster access. Better coordination.</span>
            </p>
            <nav className="flex flex-wrap items-center gap-4">
              <a href="/about" className="hover:text-brand-700">About</a>
              <a href="/services" className="hover:text-brand-700">Services</a>
              <a href="/organ-donation" className="hover:text-brand-700">Organ donation</a>
              <a href="/notifications" className="hover:text-brand-700">Notifications</a>
            </nav>
          </div>
          <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-ink-subtle sm:px-6">
            PanaNexus assists coordination and information only. Clinical decisions remain with licensed professionals.
          </div>
        </footer>
      </body>
    </html>
  );
}