'use client';

import Link from 'next/link';
import { Sparkles, ExternalLink } from 'lucide-react';
import { SiInstagram, SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { motion, useReducedMotion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, staggerItemVariants, VIEWPORT_ONCE_GENEROUS } from '@/lib/animations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

interface SocialLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Cuisines', href: '/#cuisines' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/fedright',
    icon: SiInstagram,
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/fedright',
    icon: SiX,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@fedright',
    icon: SiYoutube,
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/fedright',
    icon: ExternalLink, // LinkedIn icon not available in simple-icons package version
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FooterProps {}

export function Footer({}: FooterProps) {
  // When the user has requested reduced motion, skip y-axis translations
  // and use opacity-only fades instead. This prevents vestibular discomfort
  // from the upward sweep motion while preserving the scroll-reveal effect.
  const shouldReduceMotion = useReducedMotion();

  // Override staggerItemVariants to remove y translation when motion is
  // reduced. We derive from the shared variant so timing/easing stays
  // consistent — only the transform property is altered.
  const itemVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
        },
      }
    : staggerItemVariants;

  return (
    <footer
      className="border-t border-white/5 bg-[var(--bg-secondary)]"
      aria-label="Site footer"
    >
      {/* Top gradient border line */}
      <div
        className="h-px bg-gradient-to-r from-transparent via-[var(--brand-green-border)] to-transparent"
        aria-hidden="true"
      />

      {/* Fade in on scroll entry */}
      <motion.div
        className="max-w-7xl mx-auto px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE_GENEROUS}
        variants={staggerContainerVariants}
      >

        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">

          {/* ── Column 1: Brand ── */}
          <motion.div variants={itemVariants} className="col-span-2 md:col-span-1">
            {/* Logo + name */}
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-md bg-[var(--brand-green)] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">F</span>
              </div>
              <span className="text-lg font-bold text-[var(--text-primary)]">FedRight</span>
            </Link>

            {/* Tagline */}
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-[200px]">
              One Kitchen. Every Body. Perfectly Fed.
            </p>

            {/* Social icons */}
            <div
              className="flex items-center gap-4 mt-6"
              aria-label="Social media links"
            >
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow FedRight on ${label}`}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-md',
                    'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    'hover:bg-[var(--bg-hover)] transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]'
                  )}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* ── Columns 2–4: Link columns ── */}
          {FOOTER_COLUMNS.map((col) => (
            <motion.nav key={col.heading} variants={itemVariants} aria-label={`${col.heading} links`}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-3 list-none" role="list">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className={cn(
                        'text-sm text-[var(--text-muted)]',
                        'hover:text-[var(--text-primary)] transition-colors duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] focus-visible:rounded-sm'
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          ))}

        </div>

        {/* ── Bottom bar ── */}
        <div
          className={cn(
            'mt-12 pt-8 border-t border-white/5',
            'flex flex-col sm:flex-row justify-between items-center gap-4'
          )}
        >
          {/* Copyright */}
          <p className="text-sm text-[var(--text-muted)] text-center sm:text-left">
            &copy; 2026 FedRight. Made with love in India.
          </p>

          {/* Powered by AI badge */}
          <div
            className={cn(
              'flex items-center gap-1.5',
              'text-xs text-[var(--text-muted)]',
              'border border-white/10 rounded-full px-3 py-1.5'
            )}
            aria-label="Powered by artificial intelligence"
          >
            <Sparkles className="w-3 h-3 text-[var(--brand-green)]" aria-hidden="true" />
            <span>Powered by AI</span>
          </div>
        </div>

      </motion.div>
    </footer>
  );
}
