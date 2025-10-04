'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/pools', label: 'Pools' },
  { href: '/miners', label: 'Miners' },
  { href: '/connect', label: 'Connect' },
  { href: '/faq', label: 'FAQ' },
  { href: '/support', label: 'Support' },
];

const linkClasses = (active: boolean) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-neutral-900 text-white border border-neutral-700 shadow-sm shadow-black/40'
      : 'text-neutral-300 hover:text-white hover:bg-neutral-900 border border-transparent'
  }`;

export const Navigation = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-neutral-200">
          <span className="h-2 w-2 rounded-full bg-neutral-100" aria-hidden />
          Miningcore WebUI 2
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 lg:hidden"
          onClick={() => setOpen((prev) => !prev)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClasses(pathname === link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {open ? (
        <nav className="border-t border-neutral-800 bg-neutral-950 px-4 py-3 sm:px-6 lg:hidden">
          <div className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClasses(active)}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
};

export default Navigation;
