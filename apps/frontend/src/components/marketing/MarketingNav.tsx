'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/security', label: 'Security' },
  { href: '/industries', label: 'Industries' },
  { href: '/pricing', label: 'Pricing' },
];

export function MarketingNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === '/';

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    setScrolled(false);
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [isHome]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.06] bg-mk-bg/95 shadow-lg shadow-black/20 backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Varied Reach home">
          <Logo size="sm" variant="light" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors duration-150',
                pathname === link.href
                  ? 'text-white'
                  : 'text-mk-t2 hover:text-white',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-mk-t2 transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-md p-1.5 text-mk-t2 hover:text-white lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-white/[0.06] bg-mk-bg px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-white/[0.06] text-white'
                    : 'text-mk-t2 hover:text-white',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
            <Link
              href="/login"
              className="block rounded-md px-3 py-2.5 text-center text-sm font-medium text-mk-t2 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="block rounded-md bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-500"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
