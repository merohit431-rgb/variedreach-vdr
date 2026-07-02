import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const PRODUCT_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/industries', label: 'Industries' },
];

const SOLUTIONS_LINKS = [
  { href: '/industries#cirp', label: 'Insolvency & CIRP' },
  { href: '/industries#ma', label: 'M&A Due Diligence' },
  { href: '/industries#liquidation', label: 'Liquidation' },
  { href: '/industries#pe', label: 'Private Equity & VC' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo size="sm" variant="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Secure virtual data rooms built for CIRP, liquidation, M&amp;A due diligence, and every
              high-stakes Indian enterprise transaction.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 text-sm text-slate-400">
              <a
                href="mailto:rohit@variedreach.com"
                className="flex items-center gap-2 transition-colors hover:text-slate-200"
              >
                <Mail className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                rohit@variedreach.com
              </a>
              <a
                href="tel:+918851096461"
                className="flex items-center gap-2 transition-colors hover:text-slate-200"
              >
                <Phone className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                +91 88510 96461
              </a>
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                S Block 376, Panchsheel Park, New Delhi 110017
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product</p>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Solutions</p>
            <ul className="mt-4 space-y-2.5">
              {SOLUTIONS_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href="/signup"
                className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Varied Reach. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/faq" className="text-xs text-slate-600 transition-colors hover:text-slate-400">
              FAQ
            </Link>
            <Link href="/contact" className="text-xs text-slate-600 transition-colors hover:text-slate-400">
              Contact
            </Link>
            <Link href="/about" className="text-xs text-slate-600 transition-colors hover:text-slate-400">
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
