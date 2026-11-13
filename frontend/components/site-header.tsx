'use client';

import { Megaphone, Menu, Search, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-xl text-blue-600 shrink-0"
          >
            <Sparkles className="h-6 w-6 text-amber-500" />
            <span>Premiático</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
            <Link
              href="/#campanas"
              className="text-slate-600 hover:text-blue-600 transition whitespace-nowrap"
            >
              Campañas
            </Link>
            <Link
              href="/pedido"
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-blue-700 hover:bg-blue-100 transition whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              Consultar pedido
            </Link>
          </nav>

          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        aria-hidden={!drawerOpen}
        className={`fixed inset-0 z-50 md:hidden flex justify-end transition-opacity duration-300 ease-out ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`relative z-10 flex h-full w-72 max-w-[82vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b px-4 py-3.5">
            <Link
              href="/"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-2 font-extrabold text-lg text-blue-600"
            >
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span>Premiático</span>
            </Link>
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <Link
              href="/#campanas"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition"
            >
              <Megaphone className="h-4 w-4 text-blue-600" />
              <span>Campañas</span>
            </Link>
            <Link
              href="/pedido"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              <Search className="h-4 w-4" />
              <span>Consultar pedido</span>
            </Link>
          </nav>

          <div className="border-t px-4 py-3 text-xs text-slate-500">
            Costa Rica · ¡Más chances, más emoción!
          </div>
        </aside>
      </div>
    </>
  );
}
