'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

// Deep-links into the homepage product showcase -- each anchor selects the
// matching tab and scrolls to the platform section.
const PRODUCT_LINKS = [
  { href: '/#data-rooms', label: 'Data rooms & files' },
  { href: '/#watermarking', label: 'Dynamic watermarking' },
  { href: '/#permissions', label: 'Permissions & RBAC' },
  { href: '/#audit-trail', label: 'Audit trail' },
  { href: '/#reports', label: 'Reports & analytics' },
  { href: '/#cloud-import', label: 'Cloud import' },
];

const SOLUTIONS_LINKS = [
  { href: '/industries#cirp', label: 'Insolvency & CIRP' },
  { href: '/industries#liquidation', label: 'Liquidation' },
  { href: '/industries#ma', label: 'M&A Due Diligence' },
  { href: '/industries#pe', label: 'Private Equity & VC' },
];

type MenuKey = 'product' | 'solutions';

function DesktopDropdown({
  label,
  links,
  footerLink,
  open,
  onOpen,
  onClose,
}: {
  label: string;
  links: { href: string; label: string }[];
  footerLink?: { href: string; label: string };
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        onClick={open ? onClose : onOpen}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1 text-sm font-medium transition-colors duration-150',
          open ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900',
        )}
      >
        {label}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 w-60 -translate-x-1/2 pt-3">
          <div className="rounded-xl border border-slate-200 bg-white py-2 shadow-popover">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="block px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
            {footerLink && (
              <>
                <div className="my-1.5 border-t border-slate-100" />
                <Link
                  href={footerLink.href}
                  onClick={onClose}
                  className="block px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-slate-50"
                >
                  {footerLink.label}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<MenuKey | null>(null);
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
    setOpenDropdown(null);
  }, [pathname]);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openDropdown]);

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Varied Reach home" className="flex-shrink-0">
          <Logo size="sm" showSubtitle />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          <DesktopDropdown
            label="Product"
            links={PRODUCT_LINKS}
            footerLink={{ href: '/features', label: 'All features →' }}
            open={openDropdown === 'product'}
            onOpen={() => setOpenDropdown('product')}
            onClose={() => setOpenDropdown(null)}
          />
          <DesktopDropdown
            label="Solutions"
            links={SOLUTIONS_LINKS}
            open={openDropdown === 'solutions'}
            onOpen={() => setOpenDropdown('solutions')}
            onClose={() => setOpenDropdown(null)}
          />
          <Link
            href="/security"
            className={cn(
              'text-sm font-medium transition-colors duration-150',
              pathname === '/security' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Security
          </Link>
          <Link
            href="/pricing"
            className={cn(
              'text-sm font-medium transition-colors duration-150',
              pathname === '/pricing' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Pricing
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/book-demo"
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Book a demo
          </Link>
        </div>

        {/* Mobile: the demo CTA stays visible in the header, never buried in the menu */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/book-demo"
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Book a demo
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 text-slate-500 hover:text-slate-900"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Product
              </p>
              <div className="mt-1.5 flex flex-col">
                {PRODUCT_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Solutions
              </p>
              <div className="mt-1.5 flex flex-col">
                {SOLUTIONS_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex flex-col border-t border-slate-200 pt-3">
              <Link
                href="/security"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Security
              </Link>
              <Link
                href="/pricing"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
