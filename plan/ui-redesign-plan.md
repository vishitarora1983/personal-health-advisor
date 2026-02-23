# FedRight: Complete UI Redesign Plan

## Context

The current app ("Personal Health Advisor") uses a light "Botanical Luxe" design system with emerald/cream/amber colors. It has no public landing page — users land directly in an authenticated app shell with a sidebar. The design is functional but doesn't market the product or create the premium, aspirational feel needed to draw users in.

**Goal:** Transform the entire UI into a dark-mode-first, animation-rich, visually stunning experience that:
- Opens with a cinematic landing page that sells the product before users even sign up
- Positions FedRight as India's premium household AI nutritionist
- Uses AI-generated imagery featuring Indian families, cuisines, and culture
- Delivers scroll-driven animations, parallax, carousels, and micro-interactions that rival (and surpass) fittr.com
- Rebrands the entire in-app experience under the FedRight dark design system

**Tagline:** "One Kitchen. Every Body. Perfectly Fed."
**Positioning:** Household-first AI nutritionist (Angle A + B from brainstorm)

### Confirmed Decisions
- **Routing:** Restructure to `/app/*` for authenticated pages, `/` becomes public landing
- **Logo:** v2 (green square with F+checkmark) as primary mark
- **Execution:** Phase-by-phase — deliver landing page first for review, then app dark mode

### Execution Phases
- **Delivery 1 (This Sprint):** Phase 0 (Brand) + Phase 1 (Landing Page) + Phase 3 (AI Images) + Phase 4 (Animations) — the complete public landing page experience
- **Delivery 2 (Next Sprint):** Phase 2 (App Dark Mode) + Phase 5 (Route Restructure) — restyle all authenticated pages and restructure routes

---

## Phase 0: Brand Identity & Design System

### Logo Choice
Use **`fedright-logo-gemini-v2.png`** (the green rounded-square "F" with checkmark) as primary — it's more polished, app-icon-ready, and works beautifully on dark backgrounds. The v1 fork logo can be a secondary mark.

### Color Palette (Dark Mode)
```
Background:
  --bg-primary:       #0B0D0F       (near-black with blue undertone)
  --bg-secondary:     #12151A       (dark card background)
  --bg-tertiary:      #1A1E26       (elevated surfaces)
  --bg-hover:         #222833       (hover states)

Brand Green (from logo):
  --brand-green:      #1B8B4D       (primary green)
  --brand-green-light:#2AAF65       (hover/active green)
  --brand-green-glow: #1B8B4D33     (glow effects)
  --brand-green-subtle:#1B8B4D15    (backgrounds)

Brand Amber/Orange:
  --brand-amber:      #E6920A       (accent, CTAs)
  --brand-amber-light:#F0A830       (hover amber)
  --brand-amber-glow: #E6920A33     (glow effects)

Text:
  --text-primary:     #F0F2F5       (headings, primary text)
  --text-secondary:   #9BA3B0       (body text)
  --text-muted:       #5C6370       (captions, hints)

Glass/Surface:
  --surface-glass:    rgba(255,255,255,0.04)
  --surface-border:   rgba(255,255,255,0.08)
  --surface-elevated: rgba(255,255,255,0.06)

Semantic:
  --color-success:    #2AAF65
  --color-warning:    #F0A830
  --color-error:      #E5534B
  --color-info:       #539BF5
```

### Typography
- **Display:** `Inter` (modern, clean, works at all sizes) — weight 700/800 for headlines
- **Body:** `Inter` weight 400/500 — clean readability on dark backgrounds
- **Accent/Brand:** Logo text style for "FedRight" wordmark only

### Glassmorphism Tokens
```css
--glass-bg: rgba(255, 255, 255, 0.03);
--glass-border: 1px solid rgba(255, 255, 255, 0.06);
--glass-blur: blur(20px) saturate(1.5);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### Save as `brand_assets/brand-style-guide.md`

---

## Phase 1: Public Landing Page (`/`)

The landing page is the **gateway** — a cinematic, scroll-driven marketing experience. It should be accessible WITHOUT authentication. The authenticated app lives at `/app/*` routes.

### Routing Architecture Change
```
/                    → Public landing page (new)
/login               → Login page (redesigned dark)
/signup              → Signup page (redesigned dark)
/app                 → Authenticated app home (dashboard/quick-nav)
/app/profile         → Profile management
/app/meal-plan       → Meal planning
/app/tracking        → Meal tracking
/app/grocery         → Grocery lists
/app/chefs-view      → Chef's View
/app/dashboard       → Analytics
/app/settings        → Settings
```

### Landing Page Sections (10 sections, scroll-driven)

---

#### Section 1: Navigation Bar
- **Transparent** on top, transitions to **glass-morphic dark** on scroll (backdrop-blur)
- Left: FedRight logo (v2) + wordmark
- Center: Nav links (Features, How It Works, Cuisines, Testimonials)
- Right: "Log In" (ghost button) + "Get Started Free" (green filled button with glow)
- **Sticky** with smooth background transition at 80px scroll
- Mobile: hamburger with slide-in dark drawer

---

#### Section 2: Hero (Full Viewport)
- **Background:** Dark gradient with animated subtle grain/noise texture + floating particle dots (green/amber)
- **Left side (60%):**
  - Eyebrow badge: "AI-Powered Nutrition for Indian Families" (pill with green border + sparkle icon)
  - H1: **"One Kitchen.**" (line 1) **"Every Body."** (line 2) **"Perfectly Fed."** (line 3, amber gradient text)
  - Subtitle: "The AI nutritionist that knows everyone in your household — from Nani's diabetes diet to your toddler's first foods. Personalized 7-day meal plans from one kitchen."
  - Two CTAs: "Start Your Free Plan" (green, glowing) + "Watch Demo" (ghost with play icon)
  - Trust strip: "Trusted by 500+ Indian families" + small avatar stack + star rating
- **Right side (40%):**
  - **AI-Generated Hero Image:** A warm, cinematic photo of an Indian family (mom, dad, grandmother, two kids) gathered around a beautifully set dinner table with diverse Indian dishes. Warm golden lighting, modern kitchen. Shot from slightly above, bokeh background.
  - Image floats with subtle parallax on scroll
  - Decorative glow ring behind image (green/amber gradient blur)
- **Animations:**
  - Text lines stagger in from left (framer-motion, 150ms delays)
  - Image scales in from 0.9 with spring physics
  - Particles drift slowly in background (CSS keyframes)
  - Trust strip fades in last

---

#### Section 3: Problem Statement (Scroll-Linked Text Reveal)
- Dark background with very subtle grid pattern
- Large text that starts dim gray, words highlight to white as user scrolls:
  - "Planning meals for a family where **everyone eats differently** shouldn't feel like a **second job**. Dad needs low-carb. Mom is vegetarian. Your teenager wants protein for the gym. Your toddler needs allergen-free portions. **One app. Every plate. Sorted.**"
- Scroll-linked: tied to scroll position (framer-motion `useScroll` + `useTransform`)
- Key phrases highlight in **amber** or **green** gradient
- Minimal, powerful, no images — just typography

---

#### Section 4: How It Works (4-Step Process)
- Section title: "Your Family's Nutrition, Handled in 4 Steps"
- **Horizontal stepper** with numbered circles (1-4) connected by animated lines
- Each step card fades in and slides up as it enters viewport:

  **Step 1 — "Tell Us About Your Household"**
  - Icon: Family profiles
  - AI Image: Indian mom on phone creating profiles, modern living room
  - "Set up profiles for each family member — their age, health goals, allergies, and food preferences."

  **Step 2 — "AI Crafts Your Weekly Plan"**
  - Icon: Sparkle/brain
  - AI Image: Beautiful spread of Indian dishes (dal, roti, sabzi, rice, curry) shot from above
  - "Our AI builds a personalized 7-day meal plan for your entire household from one kitchen."

  **Step 3 — "Smart Grocery List, Ready to Shop"**
  - Icon: Shopping cart
  - AI Image: Fresh Indian market vegetables (sabzi mandi) beautifully arranged
  - "Auto-generated grocery list organized by category. Nothing missed, nothing wasted."

  **Step 4 — "Track, Adapt, Thrive"**
  - Icon: Chart trending up
  - AI Image: Happy Indian family eating together, laughing
  - "Log meals, track nutrition, and watch your family's health transform week by week."

- Connecting line between steps animates (draws) as user scrolls
- Number counters animate from 0 when visible

---

#### Section 5: Feature Showcase (Interactive Tabs/Cards)
- Section title: "Everything You Need, Nothing You Don't"
- **Tab-based layout** — 5 feature tabs on the left, showcase area on the right
- Each tab shows:
  - Feature name + description
  - A **dark-themed app mockup screenshot** (we'll generate these with real UI once built)
  - Key stats or benefits
- Features:
  1. **AI Meal Plans** — "7-day plans in 30 seconds. Swap any meal. Regenerate any day."
  2. **Household Profiles** — "Individual + joint profiles. Kids, adults, elderly — each gets what they need."
  3. **Chef's View** — "One cooking grid for the whole family. See what to cook, for whom, and how much."
  4. **Smart Grocery** — "Category-sorted, exportable to Excel. Check off items as you shop."
  5. **Nutrition Dashboard** — "Calories, macros, adherence tracking, consistency scores."
- **Animation:** Tab content slides in from right, tab indicator glides smoothly
- On mobile: horizontal swipe carousel instead of tabs

---

#### Section 6: Cuisine Marquee ("India's Kitchen, Your Kitchen")
- Full-width section with dark background
- Section title: "From Chole Bhature to Masala Dosa — Every Cuisine, Every Kitchen"
- **Two marquee strips** scrolling in opposite directions:
  - Top strip: AI-generated images of Indian dishes (Punjabi butter chicken, South Indian idli-sambar, Gujarati thali, Bengali fish curry, Rajasthani dal bati, Hyderabadi biryani, Kerala appam, Chettinad chicken)
  - Bottom strip: Cuisine name badges/tags scrolling (Punjabi, South Indian, Gujarati, Bengali, Marathi, Rajasthani, Hyderabadi, Kerala, Chettinad, Mughlai, Street Food, Healthy Fusion)
- Each dish image is in a rounded card with dish name overlay
- **Infinite loop, pauses on hover**
- Gradient fade on left/right edges for seamless look

---

#### Section 7: The AI Difference (Comparison)
- Section title: "Not Another Calorie Counter"
- **Split layout** — FedRight vs "Other Apps"
- Left side (Other apps, dimmed/muted):
  - "Individual-only tracking"
  - "Generic meal suggestions"
  - "Manual recipe search"
  - "No family coordination"
- Right side (FedRight, highlighted green):
  - "Household-first meal intelligence"
  - "AI plans personalized to each member"
  - "One kitchen, every diet handled"
  - "Chef's View for the family cook"
  - "Kid-safe portions auto-calculated"
- Each row animates in with stagger
- Checkmark (green) vs X (muted red) icons
- Optional: animated illustration of a family tree connecting to one plate

---

#### Section 8: Social Proof / Testimonials
- Section title: "Families Who Eat Better, Together"
- **Swiper carousel** of testimonial cards (3 visible on desktop, 1 on mobile):
  - AI-generated avatar image (Indian family members)
  - Quote text
  - Name, location, family size
  - Before/after health metric (e.g., "HbA1c: 8.2 → 6.5")
- **Animated number counters** above testimonials:
  - "5,000+" Meals Planned
  - "500+" Families Served
  - "15+" Indian Cuisines
  - "98%" Satisfaction Rate
- Numbers count up from 0 when section enters viewport
- Auto-playing carousel with pause on hover, nav dots, arrow buttons

---

#### Section 9: Final CTA ("Your Family's Health Starts Here")
- Full-width dark section with large centered CTA
- Background: Subtle animated gradient mesh (green → amber → green, shifting slowly)
- AI Image: Beautiful overhead shot of an Indian thali with the FedRight logo subtly visible on a phone in the corner
- H2: "Stop Agonizing Over Dinner. Start Nourishing Your Family."
- Subtitle: "Set up your household in 2 minutes. Get your first AI-crafted meal plan instantly."
- Big CTA: "Get Started Free" (green, large, glowing hover)
- Secondary: "No credit card required"

---

#### Section 10: Footer
- Dark, clean, 4-column layout
- Col 1: Logo + tagline + social icons
- Col 2: Product (Features, How It Works, Pricing, Cuisines)
- Col 3: Company (About, Blog, Careers, Contact)
- Col 4: Legal (Privacy, Terms, Cookie Policy)
- Bottom bar: "© 2026 FedRight. Made with love in India."
- Subtle top border gradient (green → amber → transparent)

---

## Phase 2: App-Wide Dark Mode Redesign

### Layout Changes
- **Remove sidebar on landing page** — landing page has its own transparent nav
- **App shell** (`/app/*` routes): Dark sidebar + dark content area
- Sidebar: Dark glass background, green active indicators, profile switcher redesigned for dark
- All existing pages restyled with dark tokens (cards, forms, buttons, charts)

### Component Restyling
Every existing component gets dark mode treatment:
- **Card** → Dark glass surface, subtle border, shadow
- **Button** → Primary (green), Secondary (glass), Danger (red), Ghost (transparent)
- **Input/Select** → Dark bg, lighter border, white text, green focus ring
- **Modal** → Dark overlay, dark glass content
- **Badge** → Dark bg variants with colored text
- **Toast** → Dark glass with colored left border
- **Charts** (Recharts) → Dark background, green/amber/blue data colors
- **Sidebar** → Full dark with green accent bar for active route

### Page-Specific Redesigns
- **App Home** (`/app`): Welcome dashboard with profile card, quick stats, quick-nav grid — all dark
- **Profile**: Dark forms, better section dividers, green accents
- **Meal Plan**: Dark meal cards with food imagery, better day navigation
- **Tracking**: Dark tracking rows, colored status indicators
- **Grocery**: Dark categorized list, green checkmarks
- **Chef's View**: Dark grid with better visual hierarchy
- **Dashboard**: Dark charts with glowing data lines, glass stat cards
- **Settings**: Dark danger zone section
- **Login/Signup**: Cinematic dark auth pages with split layout (image + form)

---

## Phase 3: AI-Generated Images (Gemini Pro)

### Image Generation Prompts (10-12 images)

1. **Hero — Indian Family Dinner**
   "A warm, cinematic photograph of a modern Indian family of four — a mother (30s), father (30s), a grandmother (60s), and two children (ages 5 and 12) — gathered around a beautifully set wooden dining table in a modern Indian kitchen. The table has diverse Indian dishes including dal, roti, sabzi, rice, and a curry. Warm golden evening light from a window. Shallow depth of field, bokeh. The family is smiling and passing food. Shot from a slightly elevated angle. Photorealistic, editorial quality."

2. **Mom Creating Profiles**
   "A modern Indian woman in her 30s, wearing casual clothes, sitting on a comfortable sofa in a bright modern Indian living room, looking at her smartphone with a gentle smile. Soft natural lighting. Clean, aspirational lifestyle photography. Photorealistic."

3. **Indian Dishes Spread (Overhead)**
   "Stunning overhead flat-lay photograph of a diverse Indian meal spread on a dark wooden table. Include: butter chicken, dal makhani, naan bread, jeera rice, palak paneer, raita, gulab jamun, and fresh salad. Vibrant colors, steam rising, garnished with fresh coriander. Professional food photography, moody lighting with dramatic shadows. Dark background."

4. **Fresh Vegetables (Sabzi Mandi)**
   "Beautiful arrangement of fresh Indian vegetables and spices on a dark surface: fresh coriander bunches, green chilies, tomatoes, onions, potatoes, cauliflower, turmeric root, ginger, curry leaves, mustard seeds, cumin. Moody, dramatic food photography lighting. Dark background, vibrant colors popping."

5. **Happy Family Eating Together**
   "A joyful Indian family sharing a meal together at home. Parents and two children laughing while eating. Indian food on the table. Warm, candid moment. Soft golden light. Modern Indian home interior. Photorealistic, lifestyle photography."

6. **Cuisine Cards (6 images, one per cuisine):**
   - "Authentic Punjabi thali with chole bhature, butter chicken, lassi, and paneer tikka. Professional food photography, dark moody background, dramatic lighting."
   - "Traditional South Indian meal on banana leaf — idli, dosa, sambar, coconut chutney, filter coffee. Dark background, dramatic lighting."
   - "Gujarati thali with dhokla, thepla, undhiyu, dal, rice, and rotli. Colorful, neatly arranged. Dark moody background."
   - "Bengali fish curry (macher jhol), mishti doi, luchi, and begun bhaja on dark slate. Dramatic food photography."
   - "Hyderabadi biryani in a copper handi, with raita and mirchi ka salan. Steam rising. Dark background, dramatic lighting."
   - "Kerala appam with stew, fish molee, and avial. Served on traditional brass plate. Dark background, moody lighting."

7. **Thali with Phone (CTA section)**
   "Overhead shot of a beautiful colorful Indian thali on a dark table with a modern smartphone placed next to it showing a meal plan app interface. Warm lighting, shallow depth of field. Professional food photography."

### Storage
All generated images saved to: `frontend/public/images/landing/`

---

## Phase 4: Animation & Interaction System

### New Dependencies
```json
{
  "framer-motion": "^11.x",
  "swiper": "^11.x",
  "@studio-freight/lenis": "^1.x"
}
```

### Animation Inventory

| Animation | Technique | Where Used |
|-----------|-----------|------------|
| Parallax hero image | framer-motion `useScroll` + `useTransform` | Hero section |
| Staggered text reveal | framer-motion `staggerChildren` | Hero, all section titles |
| Scroll-linked text highlight | framer-motion `useScroll` + word-by-word opacity | Problem statement |
| Fade-up on scroll | framer-motion `whileInView` | All cards, steps, features |
| Number counter | `useEffect` + `requestAnimationFrame` | Stats section |
| Infinite marquee | CSS `@keyframes translateX` | Cuisine strip |
| Swiper carousel | Swiper.js with autoplay | Testimonials, mobile features |
| Navbar glass transition | framer-motion + scroll listener | Navbar |
| Button glow hover | CSS `box-shadow` transition | All CTAs |
| Card hover lift | CSS `transform` + `box-shadow` | All cards |
| Step connector line draw | framer-motion `pathLength` + SVG | How It Works |
| Page transitions | framer-motion `AnimatePresence` | Route changes in app |
| Smooth scroll | Lenis | Entire page |
| Gradient mesh animation | CSS `@keyframes` background-position | CTA section |
| Floating particles | CSS `@keyframes` with random positioning | Hero background |

---

## Phase 5: Technical Implementation

### File Structure (New & Modified)

```
frontend/
├── public/
│   └── images/
│       └── landing/          # AI-generated images (NEW)
│           ├── hero-family.png
│           ├── mom-profiles.png
│           ├── dishes-overhead.png
│           ├── fresh-vegetables.png
│           ├── family-eating.png
│           ├── cuisine-punjabi.png
│           ├── cuisine-south-indian.png
│           ├── cuisine-gujarati.png
│           ├── cuisine-bengali.png
│           ├── cuisine-hyderabadi.png
│           ├── cuisine-kerala.png
│           └── thali-phone-cta.png
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # MODIFY - conditional layout (landing vs app)
│   │   ├── page.tsx                      # REWRITE - public landing page
│   │   ├── login/page.tsx                # NEW - dark login page
│   │   ├── signup/page.tsx               # NEW - dark signup page
│   │   └── app/                          # NEW - authenticated app shell
│   │       ├── layout.tsx                # NEW - app layout with dark sidebar
│   │       ├── page.tsx                  # NEW - app home (was old page.tsx logic)
│   │       ├── profile/page.tsx          # MOVE from /profile
│   │       ├── meal-plan/page.tsx        # MOVE from /meal-plan
│   │       ├── tracking/page.tsx         # MOVE from /tracking
│   │       ├── grocery/page.tsx          # MOVE from /grocery
│   │       ├── chefs-view/page.tsx       # MOVE from /chefs-view
│   │       ├── dashboard/page.tsx        # MOVE from /dashboard
│   │       └── settings/page.tsx         # MOVE from /settings
│   │
│   ├── components/
│   │   ├── landing/                      # NEW - landing page components
│   │   │   ├── Navbar.tsx                # Transparent → glass nav
│   │   │   ├── Hero.tsx                  # Full hero with parallax
│   │   │   ├── ProblemStatement.tsx       # Scroll-linked text reveal
│   │   │   ├── HowItWorks.tsx            # 4-step process
│   │   │   ├── FeatureShowcase.tsx        # Tab-based features
│   │   │   ├── CuisineMarquee.tsx         # Infinite scrolling cuisine strip
│   │   │   ├── AIDifference.tsx           # Comparison section
│   │   │   ├── Testimonials.tsx           # Swiper testimonial carousel
│   │   │   ├── FinalCTA.tsx              # Bottom CTA section
│   │   │   ├── Footer.tsx                # Dark footer
│   │   │   ├── AnimatedCounter.tsx        # Reusable number counter
│   │   │   └── SmoothScroll.tsx           # Lenis wrapper
│   │   │
│   │   ├── ui/                           # MODIFY - all restyled for dark mode
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   │
│   │   ├── layout/
│   │   │   └── Sidebar.tsx               # MODIFY - dark mode sidebar
│   │   │
│   │   └── auth/
│   │       ├── LoginPage.tsx             # REWRITE - dark split-layout login
│   │       └── AuthGate.tsx              # MODIFY - redirect to /login instead of inline
│   │
│   ├── lib/
│   │   ├── api.ts                        # MODIFY - update route references if needed
│   │   ├── AuthContext.tsx                # KEEP
│   │   ├── ProfileContext.tsx             # KEEP
│   │   └── utils.ts                      # KEEP + add animation utilities
│   │
│   └── app/globals.css                   # REWRITE - FedRight Dark design system
│
├── brand_assets/
│   └── brand-style-guide.md              # NEW - brand documentation
│
└── package.json                          # MODIFY - add framer-motion, swiper, lenis
```

### Implementation Order

**Step 1: Foundation (Brand + Design System)**
1. Create `brand_assets/brand-style-guide.md`
2. Rewrite `globals.css` with FedRight Dark design system
3. Install new deps: `framer-motion`, `swiper`, `lenis`
4. Update `layout.tsx` for Inter font + conditional layout logic

**Step 2: Generate AI Images**
5. Use Gemini to generate all 12 images with the prompts above
6. Save to `frontend/public/images/landing/`

**Step 3: Build Landing Page Components (top-down)**
7. `SmoothScroll.tsx` — Lenis wrapper
8. `Navbar.tsx` — transparent → glass sticky nav
9. `Hero.tsx` — full hero with parallax image, staggered text, particles
10. `ProblemStatement.tsx` — scroll-linked text reveal
11. `HowItWorks.tsx` — 4-step animated process
12. `FeatureShowcase.tsx` — tab-based feature display
13. `CuisineMarquee.tsx` — infinite scrolling cuisine strip
14. `AIDifference.tsx` — comparison layout
15. `AnimatedCounter.tsx` + `Testimonials.tsx` — social proof
16. `FinalCTA.tsx` — bottom CTA with gradient mesh
17. `Footer.tsx` — dark footer
18. Assemble in `page.tsx` (landing page)

**Step 4: Restructure App Routes**
19. Create `/app/` directory with nested layout
20. Move all existing pages into `/app/*`
21. Create new `app/layout.tsx` with dark sidebar
22. Update all internal links and navigation

**Step 5: Restyle App Components**
23. Restyle all UI components for dark mode
24. Restyle Sidebar for dark mode
25. Update all page components with dark tokens
26. Restyle Recharts for dark theme
27. Create dark login/signup pages

**Step 6: Polish & Test**
28. Test all animations across viewport sizes
29. Test auth flow (landing → login → app)
30. Test all existing features still work
31. Responsive testing (mobile, tablet, desktop)
32. Performance audit (image optimization, lazy loading)

---

## Verification

1. **Start servers:** Backend on :8000, frontend on :3000
2. **Landing page test:**
   - Navigate to `http://localhost:3000` — should see public landing page
   - Scroll through all 10 sections, verify animations fire correctly
   - Click nav links — smooth scroll to sections
   - Click "Get Started Free" → navigates to `/signup`
   - Click "Log In" → navigates to `/login`
3. **Auth flow test:**
   - Sign up / log in → redirects to `/app`
   - Verify dark sidebar, profile switcher works
   - All existing features (meal plan, tracking, grocery, etc.) work correctly
4. **Animation verification:**
   - Hero parallax scrolls smoothly
   - Problem statement text reveals word-by-word
   - How It Works steps fade in with stagger
   - Number counters animate from 0
   - Cuisine marquee scrolls infinitely
   - Testimonial carousel auto-plays and is swipeable
5. **Responsive test:**
   - Mobile: hamburger menu, stacked layouts, carousel swipes
   - Tablet: 2-column grids
   - Desktop: full experience
6. **Build test:** `cd frontend && npm run build` — no errors
