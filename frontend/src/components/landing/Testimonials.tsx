'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from './AnimatedCounter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  location: string;
  householdDesc: string;
  initials: string;
  healthMetric: string;
  avatarColor: string;
}

interface StatItem {
  value: number;
  suffix: string;
  label: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS: StatItem[] = [
  { value: 5000, suffix: '+', label: 'Meals Planned' },
  { value: 500, suffix: '+', label: 'Families Served' },
  { value: 15, suffix: '+', label: 'Indian Cuisines' },
  { value: 98, suffix: '%', label: 'Satisfaction Rate' },
];

const TESTIMONIALS: Testimonial[] = [
  {
    id: 'priya',
    quote:
      "FedRight transformed our kitchen. My father-in-law's diabetes is finally managed " +
      'through diet, and my kids actually look forward to eating healthy now. The AI just ' +
      'gets what every person in our house needs.',
    name: 'Priya Sharma',
    location: 'Mumbai',
    householdDesc: 'Family of 4',
    initials: 'PS',
    healthMetric: 'HbA1c: 8.2 → 6.5',
    avatarColor: 'bg-emerald-900',
  },
  {
    id: 'rajesh-meena',
    quote:
      'Managing vegetarian meals for five people with different preferences was exhausting. ' +
      "FedRight handles it all — the kids get balanced nutrition, and the grocery list " +
      "actually makes sense. We've saved ₹3,000 a month on food waste.",
    name: 'Rajesh & Meena Patel',
    location: 'Ahmedabad',
    householdDesc: 'Family of 5',
    initials: 'RP',
    healthMetric: 'Weight: −12kg in 6 months',
    avatarColor: 'bg-amber-900',
  },
  {
    id: 'ananya',
    quote:
      "As a doctor, I'm particular about nutrition science. FedRight's recommendations " +
      "are medically sound — macro targets, micronutrient balance, appropriate caloric " +
      "deficits. I recommend it to my own patients now.",
    name: 'Dr. Ananya Iyer',
    location: 'Bangalore',
    householdDesc: 'Family of 3',
    initials: 'AI',
    healthMetric: 'Cholesterol: 240 → 185',
    avatarColor: 'bg-blue-900',
  },
  {
    id: 'vikram',
    quote:
      "With my mother's diabetes and my son's nut allergy, meal planning felt like navigating " +
      "a minefield. FedRight handles every constraint automatically. The Chef's View is " +
      'a game-changer — I know exactly what to cook and how much for each person.',
    name: 'Vikram Singh',
    location: 'Delhi',
    householdDesc: 'Family of 6',
    initials: 'VS',
    healthMetric: 'Blood Sugar: Controlled',
    avatarColor: 'bg-purple-900',
  },
  {
    id: 'lakshmi',
    quote:
      'The variety of Kerala and South Indian recipes is incredible. I can plan the whole ' +
      'week with traditional dishes I actually love, and the nutrition tracking proves ' +
      "they're just as healthy as anything else. Lost 15kg eating food I enjoy.",
    name: 'Lakshmi Nair',
    location: 'Kochi',
    householdDesc: 'Family of 4',
    initials: 'LN',
    healthMetric: 'BMI: 31 → 24',
    avatarColor: 'bg-rose-900',
  },
];

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <article
      className={cn(
        'bg-[var(--bg-secondary)] rounded-2xl p-8',
        'border border-[var(--surface-border)]',
        'flex flex-col h-full',
        'shadow-[var(--shadow-md)]'
      )}
      aria-label={`Testimonial from ${testimonial.name}`}
    >
      {/* Quote icon */}
      <Quote
        className="w-8 h-8 text-[var(--brand-green)]/20 mb-4 flex-shrink-0"
        aria-hidden="true"
      />

      {/* Quote text */}
      <blockquote className="text-[var(--text-secondary)] text-base leading-relaxed italic flex-1">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Divider */}
      <div className="h-px bg-white/5 my-6" aria-hidden="true" />

      {/* Author row */}
      <footer>
        <div className="flex items-center gap-4">
          {/* Avatar with initials */}
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              testimonial.avatarColor
            )}
            aria-hidden="true"
          >
            <span className="text-[var(--brand-green)] font-bold text-sm">
              {testimonial.initials}
            </span>
          </div>

          {/* Name + location */}
          <div className="flex-1 min-w-0">
            <p className="text-[var(--text-primary)] font-semibold text-sm truncate">
              {testimonial.name}
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">
              {testimonial.location} · {testimonial.householdDesc}
            </p>
          </div>

          {/* Health metric badge */}
          <span
            className={cn(
              'flex-shrink-0 bg-[var(--brand-green-subtle)] text-[var(--brand-green-light)]',
              'text-xs font-medium px-2 py-1 rounded-full',
              'whitespace-nowrap border border-[var(--brand-green-border)]'
            )}
            aria-label={`Health result: ${testimonial.healthMetric}`}
          >
            {testimonial.healthMetric}
          </span>
        </div>
      </footer>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface TestimonialsProps {
  id?: string;
}

export function Testimonials({ id }: TestimonialsProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="py-24 lg:py-32 bg-[var(--bg-primary)]"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-3">
            TESTIMONIALS
          </p>
          <h2
            id="testimonials-heading"
            className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)]"
          >
            Families Who Eat Better, Together
          </h2>
        </motion.div>

        {/* Stats bar */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16"
          aria-label="FedRight statistics"
        >
          {STATS.map((stat) => (
            <AnimatedCounter key={stat.label} {...stat} />
          ))}
        </div>

        {/* Testimonials swiper */}
        <Swiper
          modules={[Autoplay, Navigation, Pagination]}
          slidesPerView={1}
          spaceBetween={24}
          loop={true}
          autoplay={
            // Disable autoplay entirely for users who prefer reduced motion
            shouldReduceMotion
              ? false
              : {
                  delay: 5000,
                  // Stop auto-advancing once the user has interacted with the
                  // carousel (swipe, click, keyboard nav). Continuing to advance
                  // after interaction is disorienting — the user expressed intent
                  // to control the carousel themselves. Setting true respects
                  // that intent, which also aligns with WCAG 2.1 SC 2.2.2.
                  disableOnInteraction: true,
                  pauseOnMouseEnter: true,
                }
          }
          pagination={{ clickable: true }}
          navigation={true}
          breakpoints={{
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          className="testimonials-swiper !pb-12"
          aria-label="Customer testimonials"
        >
          {TESTIMONIALS.map((t) => (
            <SwiperSlide key={t.id} className="h-auto">
              <TestimonialCard testimonial={t} />
            </SwiperSlide>
          ))}
        </Swiper>

      </div>
    </section>
  );
}
