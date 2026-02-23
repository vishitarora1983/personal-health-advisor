'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  MotionValue,
  useReducedMotion,
} from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type WordHighlight = 'amber' | 'green' | null;

interface WordToken {
  text: string;
  highlight: WordHighlight;
  trailingSpace: boolean;
}

// ─── Copy Text & Highlight Phrases ───────────────────────────────────────────

const FULL_TEXT =
  "Planning meals for a family where everyone eats differently shouldn't feel like a second job. Dad needs low-carb. Mom is vegetarian. Your teenager wants protein for the gym. Your toddler needs allergen-free portions. One app. Every plate. Sorted.";

const AMBER_PHRASES = ['everyone eats differently', 'second job.'];
const GREEN_PHRASES = ['One app.', 'Every plate.', 'Sorted.'];

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function buildWordTokens(
  text: string,
  amberPhrases: string[],
  greenPhrases: string[]
): WordToken[] {
  const words = text.split(/(\s+)/);
  const tokens: WordToken[] = [];

  let cursor = 0;
  const lowerText = text.toLowerCase();

  // Build a character-level highlight map
  const highlights = new Array<WordHighlight>(text.length).fill(null);

  for (const phrase of amberPhrases) {
    let pos = lowerText.indexOf(phrase.toLowerCase());
    while (pos !== -1) {
      for (let i = pos; i < pos + phrase.length; i++) highlights[i] = 'amber';
      pos = lowerText.indexOf(phrase.toLowerCase(), pos + 1);
    }
  }
  for (const phrase of greenPhrases) {
    let pos = lowerText.indexOf(phrase.toLowerCase());
    while (pos !== -1) {
      for (let i = pos; i < pos + phrase.length; i++) highlights[i] = 'green';
      pos = lowerText.indexOf(phrase.toLowerCase(), pos + 1);
    }
  }

  // Split text into word tokens
  for (const chunk of words) {
    if (!chunk) continue;
    if (/^\s+$/.test(chunk)) {
      // whitespace — attach as trailing space to previous token
      if (tokens.length > 0) {
        tokens[tokens.length - 1].trailingSpace = true;
      }
      cursor += chunk.length;
    } else {
      // Non-whitespace word
      const charStart = cursor;
      // Determine highlight from first char
      const highlight = highlights[charStart] ?? null;
      tokens.push({ text: chunk, highlight, trailingSpace: false });
      cursor += chunk.length;
    }
  }

  return tokens;
}

// Pre-build tokens at module level — NOT inside the component
const WORDS: WordToken[] = buildWordTokens(FULL_TEXT, AMBER_PHRASES, GREEN_PHRASES);

// ─── Color constants ──────────────────────────────────────────────────────────
const TEXT_PRIMARY = '#F0F2F5';
const TEXT_MUTED = 'rgba(92,99,112,0.4)';
const AMBER_COLOR = '#E6920A';
const GREEN_COLOR = '#2AAF65';

// ─── WordSpan sub-component ───────────────────────────────────────────────────

function WordSpan({
  word,
  index,
  activeWordIndex,
}: {
  word: WordToken;
  index: number;
  activeWordIndex: MotionValue<number>;
}) {
  const color = useTransform(activeWordIndex, (active: number) => {
    if (index <= active) {
      if (word.highlight === 'amber') return AMBER_COLOR;
      if (word.highlight === 'green') return GREEN_COLOR;
      return TEXT_PRIMARY;
    }
    return TEXT_MUTED;
  });

  return (
    // willChange: 'color' was removed — color triggers paint (not compositing),
    // so willChange offers no GPU acceleration benefit and only wastes memory.
    <motion.span
      style={{ color }}
      className="inline transition-colors duration-100"
    >
      {word.text}
      {word.trailingSpace ? ' ' : ''}
    </motion.span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ProblemStatementProps {
  id?: string;
}

export function ProblemStatement({ id }: ProblemStatementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth spring to reduce jumpiness
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });

  // Map progress 0→1 to word index 0→WORDS.length.
  // When reduced motion is preferred, all words are always at full opacity.
  const activeWordIndex = useTransform(
    smoothProgress,
    (p: number) => shouldReduceMotion ? WORDS.length : Math.floor(p * WORDS.length)
  );

  return (
    <div
      ref={containerRef}
      id={id}
      className="relative h-[300vh]"
      aria-label="Problem statement section"
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* Sticky text block */}
      <div className="sticky top-0 h-screen flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">

          {/* Overline */}
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-8">
            Sound Familiar?
          </p>

          {/* Word-by-word animated paragraph */}
          <p
            className="text-3xl lg:text-5xl font-bold leading-tight"
            aria-label={FULL_TEXT}
          >
            {WORDS.map((word, i) => (
              <WordSpan
                key={i}
                word={word}
                index={i}
                activeWordIndex={activeWordIndex}
              />
            ))}
          </p>

        </div>
      </div>
    </div>
  );
}
