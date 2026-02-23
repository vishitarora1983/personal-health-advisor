import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ProblemStatement } from '@/components/landing/ProblemStatement';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CuisineMarquee } from '@/components/landing/CuisineMarquee';
import { AIDifference } from '@/components/landing/AIDifference';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

// Lazy-load Swiper-heavy components to defer their ~35 KB bundle from the
// initial page load. ssr:true preserves SEO and avoids CLS.
const FeatureShowcase = dynamic(
  () => import('@/components/landing/FeatureShowcase').then(m => ({ default: m.FeatureShowcase })),
  { ssr: true }
);
const Testimonials = dynamic(
  () => import('@/components/landing/Testimonials').then(m => ({ default: m.Testimonials })),
  { ssr: true }
);

export const metadata: Metadata = {
  title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
  description:
    'FedRight is the AI-powered household meal planner for Indian families. ' +
    "Personalized 7-day meal plans, smart grocery lists, and nutrition tracking " +
    "for every family member — from Nani's diabetes diet to your toddler's first foods.",
  keywords: [
    'Indian meal planning',
    'AI nutrition',
    'family meal planner',
    'Indian diet plan',
    'household nutrition',
    'personalized meal plan India',
    'healthy Indian recipes',
  ],
  openGraph: {
    title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
    description: 'AI-powered meal planning for Indian families.',
    images: [{ url: '/images/landing/og-image.png', width: 1200, height: 630 }],
  },
};

export default function LandingPage() {
  return (
    <>
      {/*
        Navbar is rendered OUTSIDE SmoothScroll because:
        1. It is fixed-position (does not scroll with page).
        2. Lenis scroll events would interfere with its scroll detection if nested.
      */}
      <Navbar />

      {/*
        SmoothScroll wraps all scrollable content.
        It initialises Lenis and forwards scroll events to framer-motion's
        global scroll value so useScroll() hooks work correctly.
      */}
      <SmoothScroll>
        <main className="bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-clip">
          {/* Each section receives its scroll-target id directly */}
          <Hero />
          <ProblemStatement id="problem" />
          <HowItWorks id="how-it-works" />
          <FeatureShowcase id="features" />
          <CuisineMarquee id="cuisines" />
          <AIDifference id="difference" />
          <Testimonials id="testimonials" />
          <FinalCTA id="cta" />
          <Footer />
        </main>
      </SmoothScroll>
    </>
  );
}
