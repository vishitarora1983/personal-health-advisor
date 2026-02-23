'use client';

// Navbar.tsx
//
// Landing page navigation bar.
//
// Accessibility features implemented here:
//  - role="navigation" via <nav> with aria-label
//  - Hamburger button has aria-expanded and aria-controls pointing at the drawer
//  - Mobile drawer has role="dialog" aria-modal="true"
//  - Focus trap: when the drawer opens the close button receives focus, and
//    Tab/Shift+Tab are intercepted to cycle within the drawer's focusable
//    elements only. Escape closes the drawer (handled on the drawer element
//    itself, not window, so it doesn't bleed through to the rest of the page).
//  - Body scroll is locked while the drawer is open.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, useScroll, useMotionValueEvent, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';

const NAV_LINKS: { label: string; sectionId: string }[] = [
  { label: 'Features', sectionId: 'features' },
  { label: 'How It Works', sectionId: 'how-it-works' },
  { label: 'Cuisines', sectionId: 'cuisines' },
  { label: 'Testimonials', sectionId: 'testimonials' },
];

// CSS selector for all interactive elements that can receive keyboard focus.
// Excludes elements that are visually hidden or explicitly inert.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function scrollToSection(sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const shouldReduceMotion = useReducedMotion();

  // Refs for the focus trap implementation.
  // drawerRef   — the drawer panel element; we query focusable children from it.
  // closeButtonRef — the first element to receive focus when the drawer opens.
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Tracks the current isScrolled value as a ref so we can skip redundant
  // setState calls inside the scroll handler. Without this guard, every single
  // scroll frame would call setIsScrolled — even when the boolean value has not
  // changed — causing unnecessary re-renders of the entire Navbar subtree.
  // The ref mirrors the state value but does not trigger renders on its own.
  const isScrolledRef = useRef(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const shouldBeScrolled = latest > 80;
    // Only update state when the boolean threshold actually changes, not on
    // every scroll frame. This avoids ~60 redundant renders per second while
    // the user is scrolling within a single threshold zone.
    if (shouldBeScrolled !== isScrolledRef.current) {
      isScrolledRef.current = shouldBeScrolled;
      setIsScrolled(shouldBeScrolled);
    }
  });

  // ── Focus initial element when drawer opens ───────────────────────────────
  // requestAnimationFrame defers the focus call until after React has committed
  // the DOM update and Framer Motion has started the entrance animation.
  // Without it, focus() can silently fail if called before the element is
  // painted/interactive.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const rafId = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isMobileMenuOpen]);

  // ── Lock body scroll when drawer is open ─────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // ── Focus trap keyboard handler ───────────────────────────────────────────
  // Handles Tab, Shift+Tab, and Escape from within the drawer container.
  // Querying focusable elements at event time (not once at open) keeps the
  // list accurate even if any element is conditionally rendered later.
  const handleDrawerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }

      if (e.key !== 'Tab') return;

      const drawer = drawerRef.current;
      if (!drawer) return;

      // Collect all currently focusable descendants.
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on the first element, wrap to last.
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on the last element, wrap to first.
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    []
  );

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'backdrop-blur-xl bg-black/60 border-b border-white/[0.06]'
          : 'bg-transparent'
      )}
      // Slide-down from above on page load — disabled for reduced motion
      initial={shouldReduceMotion ? { opacity: 0 } : { y: -80, opacity: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav
        className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between"
        aria-label="Primary navigation"
      >
        {/* ── LEFT: Logo + Brand Name ── */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          {/* Logo placeholder — replace with actual SVG/Image when asset is ready */}
          <div className="w-9 h-9 rounded-lg bg-[var(--brand-green)] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            FedRight
          </span>
        </Link>

        {/* ── CENTER: Desktop Nav Links ── */}
        <ul className="hidden md:flex items-center gap-8 list-none" role="list">
          {NAV_LINKS.map(({ label, sectionId }) => (
            <li key={sectionId}>
              <button
                onClick={() => scrollToSection(sectionId)}
                className={cn(
                  'text-sm font-medium text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-[var(--brand-green)] focus-visible:rounded-sm'
                )}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        {/* ── RIGHT: CTA Buttons + Hamburger ── */}
        <div className="flex items-center gap-3">
          {/* Log In — desktop only */}
          <Link
            href={ROUTES.PUBLIC.LOGIN}
            className={cn(
              'hidden md:inline-flex items-center px-4 py-2 rounded-lg',
              'text-sm font-medium text-white',
              'border border-white/10',
              'hover:bg-white/5 transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]'
            )}
          >
            Log In
          </Link>

          {/* Get Started Free — desktop only */}
          <Link
            href={ROUTES.PUBLIC.SIGNUP}
            className={cn(
              'hidden md:inline-flex items-center px-5 py-2 rounded-lg',
              'text-sm font-semibold text-white bg-[var(--brand-green)]',
              'hover:bg-[var(--brand-green-light)]',
              'transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]'
            )}
          >
            Get Started Free
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={cn(
              'md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] rounded-md'
            )}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span className="w-5 h-0.5 bg-[var(--text-primary)] rounded-full" />
            <span className="w-5 h-0.5 bg-[var(--text-primary)] rounded-full" />
            <span className="w-3 h-0.5 bg-[var(--text-primary)] rounded-full self-start" />
          </button>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop overlay — click to dismiss, hidden from AT */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99]"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel
                onKeyDown here (not on window) keeps the Escape/Tab handling
                scoped to the drawer — it won't interfere with other parts of
                the page and is automatically removed when the drawer unmounts. */}
            <motion.div
              // Attach drawerRef via the ref callback so Framer Motion can still
              // manage its own internal ref on this element.
              ref={drawerRef}
              id="mobile-nav-drawer"
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed top-0 right-0 bottom-0 w-[280px]',
                'bg-[var(--bg-secondary)] border-l border-[var(--surface-border)]',
                'flex flex-col px-6 py-8 z-[100]',
                'overflow-y-auto'
              )}
              onKeyDown={handleDrawerKeyDown}
            >
              {/* Close button — receives focus on drawer open (see useEffect above).
                  It is the first focusable element so it is also the Tab wrap target
                  from the last focusable element (the "Get Started Free" link). */}
              <button
                ref={closeButtonRef}
                onClick={() => setIsMobileMenuOpen(false)}
                className="self-end mb-10 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] rounded-sm"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Nav links */}
              <ul className="flex flex-col gap-1 list-none">
                {NAV_LINKS.map(({ label, sectionId }) => (
                  <li key={sectionId}>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setTimeout(() => scrollToSection(sectionId), 200);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg',
                        'text-base font-medium text-[var(--text-secondary)]',
                        'hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                        'transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]'
                      )}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Divider */}
              <div className="my-6 h-px bg-[var(--surface-border)]" />

              {/* CTA buttons — "Get Started Free" is the last focusable element;
                  pressing Tab from it wraps back to the close button. */}
              <div className="flex flex-col gap-3">
                <Link
                  href={ROUTES.PUBLIC.LOGIN}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex justify-center px-4 py-3 rounded-lg text-sm font-medium text-white border border-white/10 hover:bg-white/5 transition-colors duration-200"
                >
                  Log In
                </Link>
                <Link
                  href={ROUTES.PUBLIC.SIGNUP}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-[var(--brand-green)] hover:bg-[var(--brand-green-light)] transition-colors duration-200"
                >
                  Get Started Free
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
