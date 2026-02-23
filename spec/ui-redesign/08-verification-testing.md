# FedRight UI Redesign — Verification & QA Test Plan

**Document Version:** 1.0
**Date:** 2026-02-20
**Status:** Approved for Implementation
**Phase Coverage:** All phases (0–5) across Deliveries 1 and 2

---

## Table of Contents

1. [Pre-Flight Checks](#1-pre-flight-checks)
2. [Landing Page Tests (Section by Section)](#2-landing-page-tests-section-by-section)
3. [Authentication Flow Tests](#3-authentication-flow-tests)
4. [App Dark Mode Visual Tests](#4-app-dark-mode-visual-tests)
5. [Responsive Breakpoint Tests](#5-responsive-breakpoint-tests)
6. [Performance Tests](#6-performance-tests)
7. [Accessibility Tests](#7-accessibility-tests)
8. [Cross-Browser Tests](#8-cross-browser-tests)
9. [Regression Checklist — Existing Features](#9-regression-checklist--existing-features)

---

## How to Use This Document

Each test case is written in the format:

```
[ ] TC-XXX | Description | Steps | Expected Result | Pass Criteria
```

A test passes when the expected result matches the actual result exactly. Any deviation — even cosmetic — is logged as a defect with a severity level:

- **P0 (Critical):** App crashes, auth fails, data loss, route 404 — ship blocker
- **P1 (High):** Major visual break, animation fails completely, layout collapses — must fix before release
- **P2 (Medium):** Minor visual inconsistency, animation timing off, non-critical layout gap — fix before release if time permits
- **P3 (Low):** Pixel-level misalignment, minor hover state, cosmetic — log and address in follow-up

---

## 1. Pre-Flight Checks

These checks must pass before any functional testing begins. They validate the environment is correctly set up.

### 1.1 Dependency Installation

```
[ ] PF-001 | npm install succeeds
    Steps:
      1. Navigate to frontend/ directory
      2. Delete node_modules/ and package-lock.json
      3. Run: npm install
    Expected: Exit code 0, no peer dependency errors in output
    Pass criteria: "added X packages" with zero "WARN peer dep" for framer-motion, swiper, lenis, React 19
    Fail indicator: Any "npm ERR!" in output, or missing packages in node_modules/

[ ] PF-002 | New dependencies are installed at correct versions
    Steps:
      1. Run: npm ls framer-motion swiper @studio-freight/lenis
    Expected output contains:
      framer-motion@11.x.x
      swiper@11.x.x
      @studio-freight/lenis@1.x.x
    Pass criteria: All three packages listed without "(deduped)" version conflicts

[ ] PF-003 | No TypeScript compilation errors
    Steps:
      1. Run: npx tsc --noEmit
    Expected: Exit code 0, zero errors in output
    Pass criteria: Terminal shows no output (silent = success for tsc --noEmit)
    Fail indicator: Any TS error lines in output

[ ] PF-004 | Production build succeeds
    Steps:
      1. Run: npm run build
    Expected: Build completes with "Route (app)" table in output, no errors
    Pass criteria:
      - Exit code 0
      - No "Build error" text in output
      - No "Type error" text in output
      - Route "/" appears in the build output as a static page
      - Routes "/app/*" appear in the build output as dynamic (server-side) pages
    Fail indicator: Any red error text, "Failed to compile"

[ ] PF-005 | Development server starts on correct port
    Steps:
      1. Run: npm run dev
      2. Wait for "Ready" message
    Expected: "▲ Next.js 15.x.x" followed by "- Local: http://localhost:3000"
    Pass criteria: Browser can load http://localhost:3000 without error

[ ] PF-006 | Backend API server is reachable
    Steps:
      1. In separate terminal: cd backend && ./venv/bin/python -m uvicorn main:app --reload --port 8000
      2. Run: curl http://localhost:8000/health (or /docs)
    Expected: HTTP 200 response
    Pass criteria: Backend responds, frontend dev server shows no CORS errors on app pages

[ ] PF-007 | globals.css uses only layered CSS
    Steps:
      1. Open src/styles/globals.css
      2. Search for any CSS rules outside @layer base, @layer components, @layer utilities blocks
    Expected: All custom rules are inside @layer declarations
    Pass criteria: Zero unlayered custom CSS rules found
    Note: @import and :root {} variable declarations are exempt from this check
```

### 1.2 Build Output Verification

```
[ ] PF-008 | Landing page is statically generated (not server-rendered)
    Steps:
      1. Run npm run build
      2. Examine the Route table in build output
    Expected: "/" shows "○ Static" or "◐ SSG" indicator
    Pass criteria: Landing page does NOT show "ƒ Dynamic (Server)" — it has no server-side data dependencies

[ ] PF-009 | App pages are properly code-split
    Steps:
      1. Run npm run build
      2. Check .next/static/chunks/ for route-specific chunks
    Expected: Separate JS chunks exist for landing vs app routes
    Pass criteria: framer-motion code does not appear in app route chunks (landing-only dep)
```

---

## 2. Landing Page Tests (Section by Section)

All landing page tests are performed at http://localhost:3000 (the "/" route).

### 2.1 Section 1: Navbar

```
[ ] NAV-001 | Navbar renders transparently on page load
    Steps:
      1. Navigate to /
      2. Inspect navbar background without scrolling
    Expected: Navbar background is fully transparent (no visible background color/blur)
    Pass criteria: Computed background-color is rgba(0,0,0,0) or equivalent transparent value
    Note: Logo and links must still be visible against the hero background

[ ] NAV-002 | Navbar transitions to glass effect on scroll
    Steps:
      1. Navigate to /
      2. Scroll down exactly 50px
    Expected: Navbar gains glass morphism effect:
      - backdrop-filter: blur(12px) or similar
      - Background becomes semi-transparent dark (e.g., rgba(10,10,10,0.8))
      - Visible border-bottom or subtle separator line appears
    Pass criteria:
      - Transition is smooth (not a jarring snap)
      - Transition duration between 150ms and 300ms
      - The effect persists as user continues scrolling

[ ] NAV-003 | Navbar remains sticky at top of viewport during scroll
    Steps:
      1. Scroll page to bottom (3000px+ from top)
    Expected: Navbar is visible at the top of the viewport
    Pass criteria: Navbar position:fixed or position:sticky at top:0, z-index sufficient to overlay all sections

[ ] NAV-004 | Mobile hamburger menu appears at correct breakpoint
    Steps:
      1. Resize browser to 375px width
    Expected: Desktop nav links are hidden, hamburger icon (three lines or equivalent) is visible
    Pass criteria:
      - Desktop links not visible (display:none or hidden)
      - Hamburger button visible and clickable
      - Hamburger icon is recognizable (not a generic box)

[ ] NAV-005 | Mobile menu opens and closes correctly
    Steps:
      1. At 375px width, click hamburger button
    Expected: Full-screen or slide-in mobile menu opens showing all navigation links
    Step 2: Click hamburger again (or close button)
    Expected: Menu closes with a smooth animation
    Pass criteria:
      - Menu open animation < 300ms
      - All desktop nav links are present in mobile menu
      - Menu close animation < 300ms
      - After close, hamburger button is in focus (accessibility)

[ ] NAV-006 | Nav links trigger smooth scroll to correct sections
    Steps:
      1. At desktop width, click each nav link in navbar (e.g., "How It Works", "Features")
    Expected: Page scrolls smoothly to the corresponding section
    Pass criteria:
      - Smooth scroll (not instant jump) — animated over ~600ms
      - Target section is in viewport after scroll completes
      - URL hash updates to reflect section (e.g., #how-it-works) — optional but preferred
      - No page reload occurs

[ ] NAV-007 | "Log In" button navigates to /login
    Steps:
      1. Click "Log In" button in navbar
    Expected: Navigation to /login page
    Pass criteria: URL changes to /login, login page renders correctly, no 404

[ ] NAV-008 | "Get Started Free" / signup CTA in navbar navigates to /signup
    Steps:
      1. Click "Get Started Free" or equivalent CTA button in navbar
    Expected: Navigation to /signup page
    Pass criteria: URL changes to /signup, signup page renders correctly, no 404

[ ] NAV-009 | Logo in navbar navigates to landing page root
    Steps:
      1. Navigate to any section deep in the page
      2. Click the FedRight logo in the navbar
    Expected: Scroll returns to top of page OR navigation to /
    Pass criteria: User is at the top of the landing page, no 404
```

### 2.2 Section 2: Hero

```
[ ] HERO-001 | Hero section occupies full viewport height on load
    Steps:
      1. Navigate to /
      2. Before scrolling, measure hero section height
    Expected: Hero section height equals window.innerHeight (100vh or 100dvh)
    Pass criteria: No content below the fold is visible on initial load

[ ] HERO-002 | Headline text stagger animation plays on page load
    Steps:
      1. Navigate to /
      2. Observe headline text rendering
    Expected:
      - Each word or line of the headline fades in from below (translateY: 20px → 0px, opacity: 0 → 1)
      - Stagger delay between each word/line: 80–120ms
      - Total animation duration: < 1.5 seconds
    Pass criteria:
      - Text is not instantly visible (there is a visible stagger animation)
      - All words/lines are fully visible within 1.5 seconds of page load
      - Animation easing is smooth (ease-out or spring, not linear)

[ ] HERO-003 | Subheadline animates after headline completes
    Steps:
      1. Navigate to /
      2. Observe the subheadline / tagline animation timing
    Expected: Subheadline begins animating after the headline animation is at least 50% complete
    Pass criteria: Visible temporal separation between headline and subheadline animation start

[ ] HERO-004 | CTA buttons animate after subheadline
    Steps:
      1. Navigate to / with Chrome DevTools open
      2. Observe CTA button animation timing
    Expected: "Get Started Free" and secondary CTA buttons fade in after headline + subheadline animations
    Pass criteria:
      - Both buttons are visible within 2 seconds of page load
      - Buttons have visible entrance animation (not instant appearance)

[ ] HERO-005 | Hero image loads and parallax effect works on scroll
    Steps:
      1. Navigate to /
      2. Scroll down slowly through the hero section
    Expected:
      - Hero image is visible and sharp (not blurry or broken)
      - Image moves at a different speed than the page scroll (parallax)
      - Parallax offset: image moves at ~60% of scroll speed (so it appears to "float" behind)
    Pass criteria:
      - No broken image icon
      - Visible parallax depth difference between image and text
      - Image does not jump or stutter on scroll

[ ] HERO-006 | Particle/background effect renders without performance issues
    Steps:
      1. Navigate to /
      2. Open Chrome DevTools Performance tab
      3. Record 5 seconds of idle on hero section
    Expected: Particle background (if canvas-based) or CSS animation runs without frame drops
    Pass criteria:
      - No layout paint or reflow triggered by particle animation in Performance recording
      - FPS stays >= 55 during particle animation (visible in DevTools FPS meter)

[ ] HERO-007 | Hero layout is 60/40 split on desktop
    Steps:
      1. At 1440px width, inspect hero section layout
    Expected: Text content occupies ~60% of width, hero image occupies ~40% of width
    Pass criteria: Computed widths are approximately 55–65% text and 35–45% image

[ ] HERO-008 | Hero layout stacks vertically on mobile
    Steps:
      1. Resize to 375px width
    Expected: Text content appears above image, both in full width column layout
    Pass criteria:
      - No horizontal scroll
      - Both text and image are fully visible
      - Text remains readable (minimum 16px body, 32px headline)
      - Image is proportionally sized (not stretched or cropped strangely)

[ ] HERO-009 | "Get Started Free" CTA in hero navigates to /signup
    Steps:
      1. Click primary CTA button in hero section
    Expected: Navigate to /signup
    Pass criteria: URL changes to /signup, no 404

[ ] HERO-010 | Secondary CTA ("See How It Works" or similar) smooth scrolls to How It Works section
    Steps:
      1. Click secondary CTA in hero section
    Expected: Page scrolls to Section 4 (How It Works)
    Pass criteria: Smooth scroll, correct section in viewport
```

### 2.3 Section 3: Problem Statement

```
[ ] PROB-001 | Section is not visible until scrolled into view
    Steps:
      1. Navigate to / and do not scroll
    Expected: Problem section text is not yet visible (below fold)
    Pass criteria: Section is in viewport only after sufficient scroll

[ ] PROB-002 | Text reveal animation triggers on scroll into view
    Steps:
      1. Slowly scroll down until Problem section enters viewport
    Expected:
      - Text begins revealing as section enters viewport (not before, not only after fully in view)
      - Trigger point: section is ~20% into the viewport
    Pass criteria: Animation starts when section's top edge is at 80% of viewport height

[ ] PROB-003 | Word-by-word highlight animates as user scrolls through section
    Steps:
      1. Scroll slowly through the Problem section
    Expected:
      - Individual words (or groups of words) highlight one by one as scroll progresses
      - Words that have been "passed" by scroll remain highlighted
      - Words not yet reached remain in low-opacity/dimmed state
    Pass criteria:
      - Visible color/opacity difference between highlighted and non-highlighted words
      - Animation is linked to scroll position (scrolling backward un-highlights words)
      - No words skip or flash unexpectedly

[ ] PROB-004 | Problem section animation performs smoothly on scroll
    Steps:
      1. Open DevTools Performance tab
      2. Record 3 seconds while scrolling through Problem section at natural speed
    Expected: No "Long Tasks" (>50ms) triggered by the word highlight animation
    Pass criteria:
      - Frame rate stays >= 50fps
      - No layout thrashing (no "Recalculate Style" taking > 10ms)
      - No forced synchronous layout warnings

[ ] PROB-005 | Section is fully readable with all words highlighted after scrolling past
    Steps:
      1. Scroll past the Problem section entirely
      2. Scroll back up slowly to view section
    Expected: All words in the section remain in their fully-highlighted state
    Pass criteria: No words revert to dimmed state once user has scrolled past the section
```

### 2.4 Section 4: How It Works

```
[ ] HIW-001 | Three steps are visible with correct content
    Steps:
      1. Scroll to "How It Works" section
    Expected: Three distinct steps visible:
      Step 1: Build your family profile
      Step 2: AI generates your meal plan
      Step 3: Cook, track, and optimize
    Pass criteria: All three steps render with title, description, and icon/image

[ ] HIW-002 | Steps animate in on viewport entry with stagger
    Steps:
      1. Scroll until How It Works section enters viewport
    Expected:
      - Steps 1, 2, 3 animate in sequentially (stagger delay: 150–200ms between each)
      - Each step fades in with upward motion (translateY: 30px → 0, opacity: 0 → 1)
    Pass criteria: Visible stagger — step 1 is visible before step 2 begins animating

[ ] HIW-003 | Connector line between steps animates
    Steps:
      1. Scroll to How It Works section
      2. Wait for step entrance animations to complete
    Expected:
      - A line or connector element between steps 1→2 and 2→3 draws/animates
      - Line draw direction: left to right (or top to bottom on mobile)
    Pass criteria:
      - Connector line is visible
      - Line draws progressively (not instant appearance)
      - Draw animation completes within 600ms

[ ] HIW-004 | Number counter animation plays on viewport entry
    Steps:
      1. Scroll to How It Works section
      2. Observe any numeric counters (e.g., "500+ families", "10,000+ meals planned")
    Expected: Numbers count up from 0 to final value on viewport entry
    Pass criteria:
      - Counter starts at 0 when section first enters viewport
      - Count-up duration: 1.5–2 seconds
      - Uses easing (numbers accelerate, then decelerate — not linear)
      - Numbers do not re-animate if user scrolls away and returns
```

### 2.5 Section 5: Feature Showcase

```
[ ] FEAT-001 | Feature tabs render at desktop width
    Steps:
      1. At 1440px width, scroll to Features section
    Expected: Horizontal tab/pill navigation visible with multiple feature categories (e.g., "Household Planning", "Indian Cuisines", "AI Nutrition", "Smart Grocery")
    Pass criteria: At least 3 feature tabs visible, active state clearly distinguished

[ ] FEAT-002 | Tab switching changes content panel
    Steps:
      1. Click on each feature tab in sequence
    Expected: Content area updates to show the selected feature's content (image + description)
    Pass criteria:
      - Content changes on each tab click
      - No page reload
      - Previously active tab is visually deactivated, new tab is visually active

[ ] FEAT-003 | Content panel slide transition animates on tab change
    Steps:
      1. Click a non-active tab
    Expected: Outgoing content slides/fades out, incoming content slides/fades in
    Pass criteria:
      - Transition is visible (not instant)
      - Duration: 200–300ms
      - No layout shift during transition (container height remains stable)

[ ] FEAT-004 | Mobile carousel fallback at 375px
    Steps:
      1. Resize to 375px width
      2. Scroll to Features section
    Expected: Features section switches to a swipeable carousel (not tabs)
    Pass criteria:
      - Tab navigation is not visible on mobile
      - Cards are arranged horizontally, swiping is possible
      - Active card indicator (dots or current/total counter) is visible
      - Touch swipe moves to next card
```

### 2.6 Section 6: Cuisine Marquee

```
[ ] MARQ-001 | Cuisine marquee scrolls infinitely in both directions
    Steps:
      1. Scroll to Cuisine Marquee section
      2. Observe for 10 seconds
    Expected:
      - Top row scrolls left continuously
      - Bottom row (if present) scrolls right continuously
      - Animation loops seamlessly (no visible jump or gap at loop point)
    Pass criteria:
      - Scroll continues without stopping
      - No visible seam at the loop junction
      - Content repeats correctly (same sequence of cuisines)

[ ] MARQ-002 | Marquee pauses on hover
    Steps:
      1. Move mouse cursor over the marquee row
    Expected: Scrolling animation pauses while cursor is over the element
    Pass criteria:
      - Animation pauses within 1 frame of hover
      - Animation resumes immediately when cursor leaves
      - Pause does not cause a visual jump in position

[ ] MARQ-003 | Gradient fade edges are present on both sides
    Steps:
      1. Inspect left and right edges of marquee row
    Expected: CSS gradient fade from the section background color to transparent on both left and right edges, masking the marquee content as it enters/exits
    Pass criteria:
      - Visible fade effect on both sides
      - Fade width: 40–80px
      - Content behind the fade is not visible (proper masking)

[ ] MARQ-004 | All 6 cuisine images load correctly
    Steps:
      1. Open DevTools Network tab, filter by image
      2. Scroll to marquee section
    Expected: All 6 cuisine images (punjabi, south-indian, gujarati, bengali, hyderabadi, kerala) load with HTTP 200
    Pass criteria:
      - Zero 404s for cuisine images
      - All images render without broken image icon
      - Images are correct content (correct cuisine shown)

[ ] MARQ-005 | Cuisine labels are visible and correct
    Steps:
      1. Inspect each cuisine card in the marquee
    Expected: Each image has a label showing the cuisine name (e.g., "Punjabi", "South Indian")
    Pass criteria: All 6 cuisine names are visible and correctly spelled
```

### 2.7 Section 7: AI Difference

```
[ ] AID-001 | Comparison table renders with both columns
    Steps:
      1. Scroll to "Why FedRight is Different" or AI Difference section
    Expected: Two-column comparison table with headers "Traditional Apps" vs "FedRight"
    Pass criteria:
      - Both columns visible
      - Column headers clearly labeled
      - Each row has content in both columns

[ ] AID-002 | Comparison rows animate in with stagger on viewport entry
    Steps:
      1. Scroll to AI Difference section
    Expected: Each comparison row animates in from the left or from opacity:0 with stagger delay
    Pass criteria:
      - Rows appear sequentially, not all at once
      - Stagger delay: 80–150ms per row
      - All rows fully visible within 1.5 seconds of section entering viewport

[ ] AID-003 | FedRight column is visually distinguished from Traditional column
    Steps:
      1. View the comparison table
    Expected: FedRight column uses accent color (green), Traditional column uses muted/gray styling
    Pass criteria:
      - Clear visual hierarchy favoring FedRight column
      - Checkmark or positive icon on FedRight items
      - X or negative icon on Traditional items

[ ] AID-004 | Responsive layout on tablet (768px)
    Steps:
      1. Resize to 768px
    Expected: Table either adapts to narrower columns or stacks vertically (traditional above, FedRight below)
    Pass criteria: No horizontal overflow, all content readable
```

### 2.8 Section 8: Testimonials

```
[ ] TEST-001 | Testimonials section renders with minimum 3 testimonials
    Steps:
      1. Scroll to Testimonials section
    Expected: At least 3 testimonial cards visible (or carousel showing first card with dots indicating more)
    Pass criteria: 3+ testimonials present with name, text, and location/profile info

[ ] TEST-002 | Swiper carousel autoplay works
    Steps:
      1. Scroll to Testimonials and wait 5 seconds without interacting
    Expected: Carousel advances to next testimonial automatically
    Pass criteria:
      - Autoplay interval: 3–5 seconds
      - Transition animation between slides: 300–500ms
      - Autoplay continues cycling through all testimonials

[ ] TEST-003 | Autoplay pauses on hover
    Steps:
      1. Move cursor over a testimonial card
      2. Wait 5+ seconds
    Expected: Carousel does not advance while cursor is over it
    Pass criteria: Same testimonial remains visible for the entire hover duration

[ ] TEST-004 | Autoplay resumes after hover ends
    Steps:
      1. Remove cursor from testimonial section after hovering
      2. Wait up to 5 seconds
    Expected: Autoplay resumes within one autoplay interval of cursor leaving
    Pass criteria: Carousel advances to next testimonial after cursor leaves

[ ] TEST-005 | Navigation dots indicate current slide
    Steps:
      1. Observe pagination dots below carousel
    Expected: Active slide's dot is visually distinct (larger, brighter, filled) from inactive dots
    Pass criteria:
      - Dot updates in sync with slide change
      - All testimonial count is represented by dots (e.g., 5 testimonials = 5 dots)

[ ] TEST-006 | Manual slide navigation works via dots
    Steps:
      1. Click on a non-active dot
    Expected: Carousel jumps to the corresponding slide
    Pass criteria:
      - Correct slide displayed after dot click
      - Active dot updates to reflect new slide

[ ] TEST-007 | Touch/swipe navigation on mobile
    Steps:
      1. Open on real iOS or Android device (or DevTools device emulation)
      2. Swipe left on testimonial section
    Expected: Carousel advances to next testimonial
    Step 2: Swipe right
    Expected: Carousel goes back to previous testimonial
    Pass criteria: Both directions respond to swipe with momentum feel
```

### 2.9 Section 9: Final CTA

```
[ ] CTA-001 | Section background gradient mesh animation is visible
    Steps:
      1. Scroll to Final CTA section at the bottom of landing page
      2. Observe background for 5 seconds
    Expected: Background shows an animated gradient or mesh effect (subtle pulsing, color shifting, or moving particles)
    Pass criteria:
      - Animation is visible (not a static solid color)
      - Animation loops seamlessly
      - Animation is subtle enough to not distract from CTA text

[ ] CTA-002 | Primary CTA button has glow effect on hover
    Steps:
      1. Hover over the primary CTA button ("Get Started Free" or equivalent)
    Expected: Button shows a glow/halo effect in green or accent color
    Pass criteria:
      - Visible box-shadow or drop-shadow glow appears on hover
      - Glow transition duration: 150–200ms
      - Glow disappears cleanly on cursor leave

[ ] CTA-003 | Primary CTA button navigates to /signup
    Steps:
      1. Click the primary CTA button in Final CTA section
    Expected: Navigate to /signup
    Pass criteria: URL changes to /signup, signup page renders

[ ] CTA-004 | Secondary CTA (if present, e.g., "Log In") navigates correctly
    Steps:
      1. Click any secondary CTA link/button
    Expected: Navigate to /login
    Pass criteria: URL changes to /login, login page renders

[ ] CTA-005 | Section is readable on all backgrounds
    Steps:
      1. View Final CTA section with animated background playing
    Expected: Headline and subtext remain fully readable against the animated background
    Pass criteria:
      - WCAG AA contrast ratio (4.5:1 minimum) maintained between text and animated background
      - No animation frame makes text unreadable
```

### 2.10 Section 10: Footer

```
[ ] FOOT-001 | Footer renders with minimum 4 columns on desktop
    Steps:
      1. At 1440px width, scroll to footer
    Expected: Footer has at least 4 columns (e.g., Brand/Logo, Product, Company, Social)
    Pass criteria: Columns are visible side-by-side, content organized by category

[ ] FOOT-002 | Footer stacks to single column on mobile
    Steps:
      1. Resize to 375px width, scroll to footer
    Expected: All footer columns stack vertically
    Pass criteria:
      - No horizontal overflow
      - Column headings and links remain readable
      - Adequate spacing between stacked sections

[ ] FOOT-003 | All footer navigation links work correctly
    Steps:
      1. Click each internal link in footer
    Expected: Each link navigates to correct route or section
    Pass criteria:
      - No 404 errors
      - Section links (Privacy Policy, Terms, etc.) navigate or scroll correctly
      - All links have visible hover state

[ ] FOOT-004 | Social media links open in new tab
    Steps:
      1. Click social media icons in footer
    Expected: Link opens in new browser tab
    Pass criteria:
      - New tab opens
      - Target="_blank" with rel="noopener noreferrer" (verify in source)

[ ] FOOT-005 | Copyright notice shows correct year
    Steps:
      1. Check footer copyright text
    Expected: Copyright year matches current year (2026)
    Pass criteria: "© 2026 FedRight" or equivalent

[ ] FOOT-006 | Logo in footer is correct and links to top of page
    Steps:
      1. Click FedRight logo in footer
    Expected: Navigate or scroll to top of landing page
    Pass criteria: User ends up at top of /, no 404
```

---

## 3. Authentication Flow Tests

### 3.1 Landing Page to Auth Routes

```
[ ] AUTH-001 | Landing page "Get Started Free" → /signup
    Steps:
      1. Navigate to /
      2. Click primary "Get Started Free" CTA (in hero section)
    Expected: URL changes to /signup
    Pass criteria: Signup page renders with registration form

[ ] AUTH-002 | Landing page "Log In" → /login
    Steps:
      1. Navigate to /
      2. Click "Log In" in navbar
    Expected: URL changes to /login
    Pass criteria: Login page renders with email/password form and Google OAuth button

[ ] AUTH-003 | Final CTA section "Get Started" → /signup
    Steps:
      1. Scroll to bottom of landing page
      2. Click CTA in Final CTA section
    Expected: URL changes to /signup
    Pass criteria: Signup page renders correctly
```

### 3.2 Login Flows

```
[ ] AUTH-004 | Email/password login with valid credentials → /app
    Steps:
      1. Navigate to /login
      2. Enter valid registered email and password
      3. Click "Sign In" or equivalent
    Expected:
      - Authentication succeeds
      - User is redirected to /app (home dashboard)
    Pass criteria:
      - URL changes to /app
      - Dashboard content loads (not an error state)
      - User's name or profile info is visible

[ ] AUTH-005 | Email/password login with invalid credentials shows error
    Steps:
      1. Navigate to /login
      2. Enter invalid email/password combination
      3. Click "Sign In"
    Expected: Error message displayed inline (not a browser alert)
    Pass criteria:
      - Error text is visible on the login form
      - Error message is specific (e.g., "Invalid email or password")
      - Form does not navigate away on failed login
      - No 500 error or console error in DevTools

[ ] AUTH-006 | Google OAuth login button initiates OAuth flow
    Steps:
      1. Navigate to /login
      2. Click "Continue with Google" button
    Expected: Google OAuth popup or redirect appears
    Pass criteria:
      - Google sign-in UI appears (popup window or redirect to accounts.google.com)
      - No JavaScript errors in console
      - Google button shows Google logo (not broken image)

[ ] AUTH-007 | Successful Google OAuth login → /app
    Steps:
      1. Complete Google OAuth flow with a valid Google account
    Expected: User authenticated, redirected to /app
    Pass criteria:
      - URL changes to /app
      - Dashboard content loads
      - Auth token stored in cookies (fedright_token key)

[ ] AUTH-008 | Login with redirect parameter (?from=) respects return URL
    Steps:
      1. Navigate directly to /app/meal-plan (unauthenticated)
      2. Expect redirect to /login?from=/app/meal-plan
      3. Complete login
    Expected: After successful login, user is redirected to /app/meal-plan (not generic /app)
    Pass criteria: URL after login is /app/meal-plan, not /app
```

### 3.3 Route Protection

```
[ ] AUTH-009 | Unauthenticated access to /app redirects to /login
    Steps:
      1. Ensure no auth cookie is present (clear cookies or use incognito)
      2. Navigate directly to /app
    Expected: Redirect to /login
    Pass criteria:
      - URL changes to /login (or /login?from=/app)
      - Login page renders
      - No app dashboard content is briefly visible (no flash of content)

[ ] AUTH-010 | Unauthenticated access to each /app/* route redirects
    Steps:
      1. Clear cookies
      2. Navigate to each route: /app/profile, /app/meal-plan, /app/tracking, /app/grocery, /app/chefs-view, /app/dashboard, /app/settings
    Expected: All redirect to /login
    Pass criteria: All 7 routes redirect without 404 or rendering app content

[ ] AUTH-011 | Authenticated user on / is NOT auto-redirected
    Steps:
      1. Log in (auth cookie present)
      2. Navigate to /
    Expected: Landing page renders (not automatically redirected to /app)
    Pass criteria:
      - URL remains /
      - Full landing page is visible
      - Navbar may optionally show "Go to App" instead of "Get Started Free" — but this is a stretch goal, not required

[ ] AUTH-012 | Logout from /app → redirects to /
    Steps:
      1. While authenticated in /app, click Logout in sidebar or settings
    Expected:
      - Auth cookie is cleared
      - User redirected to / (landing page)
    Pass criteria:
      - URL changes to /
      - Landing page renders
      - Attempting to navigate back to /app redirects to /login (cookie was actually cleared)
```

---

## 4. App Dark Mode Visual Tests

All app dark mode tests are performed while authenticated (logged in). Navigate to each route and perform visual inspection.

### Color Token Verification

For each page, the following color rules must be satisfied:

| Element Type | Expected Dark Value | Tailwind Equivalent |
|---|---|---|
| Page background | #111827 | gray-900 |
| Card / panel background | #1f2937 | gray-800 |
| Elevated card (nested) | #374151 | gray-700 |
| Primary text | #f9fafb | gray-50 |
| Secondary text | #9ca3af | gray-400 |
| Muted text / placeholder | #6b7280 | gray-500 |
| Border / separator | #374151 | gray-700 |
| Input background | #1f2937 | gray-800 |
| Input border | #4b5563 | gray-600 |
| Input focus border | #22c55e | green-500 |
| Primary button bg | #22c55e | green-500 |
| Primary button text | #111827 | gray-900 (dark on green) |

### 4.1 /app (Home Dashboard)

```
[ ] DARK-APP-001 | Page background is dark (gray-900)
    Expected: body / main wrapper background is #111827

[ ] DARK-APP-002 | Stats cards use card surface color (gray-800)
    Expected: Statistics / summary cards have background #1f2937, not white

[ ] DARK-APP-003 | Recent meals list uses correct text contrast
    Expected: Primary meal names in gray-50, metadata in gray-400

[ ] DARK-APP-004 | No white or light backgrounds are visible anywhere on the page
    Expected: Zero elements with background-color: white or #ffffff
    Note: Exceptions for user-uploaded avatar images only

[ ] DARK-APP-005 | Card hover states show elevation (lighter surface)
    Expected: Hovering a card lightens background from gray-800 to gray-700 (or adds subtle border highlight)
```

### 4.2 /app/profile

```
[ ] DARK-PRO-001 | Profile header card uses dark surface
    Expected: Profile card background is gray-800

[ ] DARK-PRO-002 | Member list items use correct dark surfaces
    Expected: Each family member card is gray-800, with gray-700 on hover

[ ] DARK-PRO-003 | Edit forms have dark input fields
    Expected: Input background gray-800, border gray-600, focus border green-500

[ ] DARK-PRO-004 | Form labels are readable in dark mode
    Expected: Label text is gray-300 or gray-200 (not white — too harsh, not gray-500 — too faint)

[ ] DARK-PRO-005 | Avatar placeholder uses correct dark treatment
    Expected: Avatar placeholder background gray-700, initials text gray-200
```

### 4.3 /app/meal-plan

```
[ ] DARK-MP-001 | Weekly meal grid background is page-level dark
    Expected: Grid container background is gray-900

[ ] DARK-MP-002 | Individual meal cells use card surface
    Expected: Meal cells background is gray-800

[ ] DARK-MP-003 | Meal status chips are color-coded and readable on dark
    Expected:
      - Planned: blue-500 background with white text
      - Logged: green-500 background with dark text
      - Skipped: gray-600 background with gray-200 text
    Pass criteria: All status chips pass WCAG AA contrast (4.5:1)

[ ] DARK-MP-004 | Meal swap modal has dark background
    Expected: Modal backdrop is gray-950 at 80% opacity, modal surface is gray-800

[ ] DARK-MP-005 | "Copy meal" and "Kid share" controls are visible on dark cards
    Expected: Action buttons/icons visible against gray-800 card background

[ ] DARK-MP-006 | Kid-shared meal visual indicator is distinct
    Expected: Shared meals have a visual indicator (colored border, badge) that is visible on dark surface
```

### 4.4 /app/tracking

```
[ ] DARK-TRK-001 | Tracking page background is dark
    Expected: gray-900 background

[ ] DARK-TRK-002 | Meal status buttons (3 states) have correct dark styling
    Expected:
      - Untracked: gray-700 background, gray-300 text
      - In Progress: amber-500/amber-600 background, dark text
      - Completed: green-500 background, dark text
    Pass criteria: All three states visually distinct from each other on dark background

[ ] DARK-TRK-003 | Progress bars render correctly in dark mode
    Expected: Progress bar track is gray-700, fill is green-500

[ ] DARK-TRK-004 | Daily summary card uses correct dark surface
    Expected: Summary cards are gray-800 background
```

### 4.5 /app/grocery

```
[ ] DARK-GRO-001 | Grocery list background is dark
    Expected: gray-900

[ ] DARK-GRO-002 | Category group headers are readable
    Expected: Category headers (e.g., "Vegetables", "Dairy") in gray-200 or white

[ ] DARK-GRO-003 | Grocery item rows alternate correctly on dark
    Expected: Alternating rows: gray-800 and gray-750 (or single gray-800 with gray-700 divider)

[ ] DARK-GRO-004 | Checkbox styling is visible in dark mode
    Expected: Custom checkboxes use green-500 checked state, gray-600 unchecked border — visually clear

[ ] DARK-GRO-005 | Checked/crossed-out items are visually de-emphasized
    Expected: Checked items have strikethrough text in gray-500 (not removed from list)

[ ] DARK-GRO-006 | Export button is styled correctly in dark mode
    Expected: Export button uses primary button style (green-500 background)
```

### 4.6 /app/chefs-view

```
[ ] DARK-CHV-001 | Cooking instructions surface uses dark card
    Expected: Instruction panels on gray-800 background

[ ] DARK-CHV-002 | Step numbers and ingredient quantities are readable
    Expected: Numeric values in green-400 or white for sufficient contrast on gray-800

[ ] DARK-CHV-003 | Section separators are visible on dark
    Expected: Dividers between cooking steps are gray-700 (not invisible on gray-800)
```

### 4.7 /app/dashboard

```
[ ] DARK-DASH-001 | Dashboard chart backgrounds are dark
    Expected: Recharts SVG containers have no white fill — transparent or gray-800

[ ] DARK-DASH-002 | Chart grid lines use dark-appropriate color
    Expected: Grid lines stroke is #374151 (gray-700), not the default light gray

[ ] DARK-DASH-003 | Chart axis labels are readable
    Expected: Axis text fill is #9ca3af (gray-400) — sufficient contrast on dark bg

[ ] DARK-DASH-004 | Chart tooltips use dark surface
    Expected: Tooltip background is #1f2937 (gray-800), border #374151 (gray-700), text white

[ ] DARK-DASH-005 | Line/bar chart colors are sufficiently saturated for dark bg
    Expected: Primary chart color (green) is green-400 or green-500, not the original muted green that was designed for light backgrounds

[ ] DARK-DASH-006 | Pie chart segments are all distinguishable in dark mode
    Expected: Each pie segment has adequate contrast against adjacent segments and the dark background
```

### 4.8 /app/settings

```
[ ] DARK-SET-001 | Settings page background is dark
    Expected: gray-900

[ ] DARK-SET-002 | Toggle switches render correctly in dark mode
    Expected:
      - Off state: gray-600 track with gray-400 knob
      - On state: green-500 track with white knob
      - Both states clearly distinguishable

[ ] DARK-SET-003 | Danger zone section is clearly delineated
    Expected: Danger zone has a red-900/10 or red-500 border to distinguish it from normal settings

[ ] DARK-SET-004 | Danger zone action buttons are correct color
    Expected: "Reset" and "Delete" buttons are red-500 or red-600 (not the default green)

[ ] DARK-SET-005 | Settings form inputs follow dark mode input pattern
    Expected: Same as DARK-PRO-003 — gray-800 background, gray-600 border, green-500 focus
```

### 4.9 Sidebar (All App Pages)

```
[ ] DARK-SB-001 | Sidebar background is darkest surface
    Expected: Sidebar background is gray-950 or gray-900 (darker than page content area)

[ ] DARK-SB-002 | Active navigation item is clearly highlighted
    Expected: Active page nav item has green-500 or green-600 background/left-border indicator

[ ] DARK-SB-003 | Inactive nav items have readable text
    Expected: Inactive nav link text is gray-400, on hover transitions to gray-100

[ ] DARK-SB-004 | Sidebar logo is correct version (v2)
    Expected: fedright-logo-gemini-v2.png displayed in sidebar header

[ ] DARK-SB-005 | Sidebar navigation links point to correct /app/* routes
    Expected: All sidebar links navigate to /app/[page] routes (not old root-level routes)
    Pass criteria: Zero sidebar links produce 404 errors
```

---

## 5. Responsive Breakpoint Tests

Tests performed at 4 breakpoints: **375px** (mobile), **768px** (tablet), **1024px** (small desktop), **1440px** (large desktop).

For each breakpoint, use Chrome DevTools Device Toolbar or resize the browser window.

### 5.1 Landing Page Responsive

```
[ ] RESP-001 | Navbar at 375px: hamburger visible, desktop nav hidden
[ ] RESP-002 | Navbar at 768px: hamburger visible or desktop nav visible (either acceptable)
[ ] RESP-003 | Navbar at 1024px: desktop nav visible, hamburger hidden
[ ] RESP-004 | Hero at 375px: stacked layout (text above image), no horizontal scroll
[ ] RESP-005 | Hero at 768px: stacked or side-by-side layout, no overflow
[ ] RESP-006 | Hero at 1024px: 60/40 side-by-side layout
[ ] RESP-007 | Hero headline at 375px: readable (min 32px), no truncation
[ ] RESP-008 | Problem section at 375px: text single column, word-highlight still works
[ ] RESP-009 | How It Works at 375px: steps stack vertically
[ ] RESP-010 | How It Works at 1024px: steps in horizontal row
[ ] RESP-011 | Feature Showcase at 375px: carousel mode (not tabs)
[ ] RESP-012 | Feature Showcase at 1024px: tab mode
[ ] RESP-013 | Cuisine Marquee at 375px: visible and scrolling
[ ] RESP-014 | Cuisine Marquee at 375px: marquee items sized correctly (not too large)
[ ] RESP-015 | AI Difference at 375px: single column layout (not 2-column table)
[ ] RESP-016 | Testimonials at 375px: Swiper carousel functional with touch
[ ] RESP-017 | Footer at 375px: single column stacked
[ ] RESP-018 | Footer at 768px: 2-column grid
[ ] RESP-019 | Footer at 1440px: 4-column layout
[ ] RESP-020 | No horizontal scroll at ANY breakpoint on landing page
```

### 5.2 App Pages Responsive

```
[ ] RESP-021 | Sidebar at 375px: hidden by default, accessible via hamburger/menu toggle
[ ] RESP-022 | Sidebar at 1024px+: visible and always shown
[ ] RESP-023 | Meal plan grid at 375px: scrollable horizontally (not collapsed) or adapts to daily view
[ ] RESP-024 | Dashboard charts at 375px: charts resize to fit (not overflow container)
[ ] RESP-025 | Profile form at 375px: form fields stack vertically, not side-by-side
[ ] RESP-026 | Grocery list at 375px: readable, checkboxes have adequate tap target (44×44px min)
[ ] RESP-027 | All buttons at 375px: tap targets minimum 44×44px (WCAG 2.5.5)
```

---

## 6. Performance Tests

### 6.1 Lighthouse Audits

Run Lighthouse in Chrome DevTools (Incognito mode, no extensions) on production build output (`npm run build && npm start`).

**Test on:** Landing page (`/`), and one app page (`/app`)

**Target scores:**

| Metric | Landing Page Target | App Page Target |
|---|---|---|
| Performance | >= 90 | >= 85 |
| Accessibility | >= 95 | >= 95 |
| Best Practices | >= 90 | >= 90 |
| SEO | >= 90 | N/A (authenticated) |

```
[ ] PERF-001 | Landing page Lighthouse Performance >= 90
[ ] PERF-002 | Landing page Lighthouse Accessibility >= 95
[ ] PERF-003 | Landing page Lighthouse Best Practices >= 90
[ ] PERF-004 | Landing page Lighthouse SEO >= 90
[ ] PERF-005 | App page Lighthouse Performance >= 85
[ ] PERF-006 | App page Lighthouse Accessibility >= 95
```

### 6.2 Core Web Vitals

Measured on Landing page (`/`) via Chrome DevTools > Performance tab or web.dev/measure.

```
[ ] PERF-007 | Largest Contentful Paint (LCP) < 2.5 seconds
    Measurement: Chrome DevTools Performance > Core Web Vitals overlay
    Expected: LCP element (hero image or headline text) paints within 2.5s

[ ] PERF-008 | Cumulative Layout Shift (CLS) < 0.1
    Expected: No unexpected layout shifts during page load
    Common causes to check: images without dimensions, fonts loading, dynamic content insertion

[ ] PERF-009 | Total Blocking Time (TBT) < 200ms
    Expected: JavaScript execution does not block main thread for extended periods
    Note: This is the Lighthouse equivalent of FID/INP

[ ] PERF-010 | First Contentful Paint (FCP) < 1.8 seconds
    Expected: First piece of content (navbar or hero text) is visible within 1.8s
```

### 6.3 Image Loading Performance

```
[ ] PERF-011 | Hero image uses priority loading (not lazy)
    Steps:
      1. View source or inspect <img> element for hero image
    Expected: <Image> component has priority={true} prop
    Pass criteria: Hero image is NOT lazy loaded (must display on initial page load)

[ ] PERF-012 | All non-hero landing page images are lazy-loaded
    Steps:
      1. Open DevTools Network tab, clear cache
      2. Navigate to /
      3. Do NOT scroll, observe image requests
    Expected: Only hero image loads on initial page load. Cuisine marquee images do NOT load until scrolled to.
    Pass criteria: Cuisine images show in Network tab only after scrolling to that section

[ ] PERF-013 | All images use next/image component
    Steps:
      1. Inspect page source / React DevTree
    Expected: Zero native <img> tags in landing page components (all using next/image)
    Pass criteria: No raw <img> elements found in landing component files

[ ] PERF-014 | Total landing page image payload < 500KB on initial load
    Steps:
      1. Open DevTools Network tab, filter by Img
      2. Load landing page from empty cache
      3. Do NOT scroll
    Expected: Total image transfer size for initial view < 500KB
    Pass criteria: Sum of image sizes in Network tab < 500KB
```

### 6.4 Animation Performance

```
[ ] PERF-015 | No layout thrashing during scroll animations
    Steps:
      1. Open DevTools Performance tab
      2. Start recording
      3. Scroll through the entire landing page at natural speed
      4. Stop recording
    Expected: No "Layout" or "Recalculate Style" tasks exceeding 10ms
    Pass criteria: All layout tasks < 10ms in the performance trace

[ ] PERF-016 | Scroll FPS stays >= 55fps during animated sections
    Steps:
      1. Open DevTools Performance > FPS meter (Enable paint flashing)
      2. Scroll through Problem section, Hero parallax, Cuisine Marquee
    Expected: FPS meter shows >= 55fps during all scroll animations
    Pass criteria: No visible drops to < 30fps (which would appear as visible stutter)

[ ] PERF-017 | Animations only use transform and opacity
    Steps:
      1. During Performance recording, check "Rendering" tab for green paint flashes
    Expected: Minimal paint flashing (green overlays) on animated elements
    Pass criteria: No full-page repaints triggered by scroll animations
    Note: Some paint on initial element entry is acceptable; continuous repaints on every scroll event are not
```

---

## 7. Accessibility Tests

### 7.1 Image Alt Text

```
[ ] A11Y-001 | All landing page images have descriptive alt text
    Steps:
      1. Run axe DevTools browser extension on /
      2. Check "Images" rule violations
    Expected: Zero "Image missing alt attribute" violations
    Pass criteria: All <Image> components have meaningful alt="" text
    Note: Decorative images should have alt="" (empty, not missing) — axe distinguishes these

[ ] A11Y-002 | Cuisine marquee images have correct alt text
    Expected: Each cuisine image has alt text describing the dish (e.g., alt="Dal makhani and naan, representing Punjabi cuisine")
    Pass criteria: Alt text is descriptive, not filename-based (e.g., not alt="cuisine-punjabi")

[ ] A11Y-003 | Logo image has appropriate alt text
    Expected: alt="FedRight logo" or alt="FedRight — One Kitchen, Every Body, Perfectly Fed"
    Pass criteria: Not alt="" (logo is not decorative — it's a brand identifier)
```

### 7.2 Color Contrast

```
[ ] A11Y-004 | All body text on dark backgrounds passes WCAG AA (4.5:1 ratio)
    Steps:
      1. Use Colour Contrast Analyser or DevTools Accessibility panel
      2. Test primary body text (gray-50 on gray-900 = approximately 18:1 — should pass easily)
    Expected: All text/background pairs >= 4.5:1 ratio

[ ] A11Y-005 | Secondary/muted text passes WCAG AA
    Expected: gray-400 (#9ca3af) on gray-900 (#111827) passes 4.5:1
    Calculated ratio: ~6.4:1 — should pass
    Pass criteria: No gray text lighter than gray-400 is used for body copy

[ ] A11Y-006 | Status chip text passes WCAG AA on chip background
    Expected:
      - Green-500 background with gray-900 text: check ratio
      - Amber-500 background with gray-900 text: check ratio
      - Blue-500 background with white text: check ratio
    Pass criteria: All chip color combinations pass 4.5:1 minimum

[ ] A11Y-007 | Button text passes WCAG AA on button background
    Expected: gray-900 text on green-500 background — passes (calculated ~6.8:1)
    Pass criteria: All button text/background pairs >= 4.5:1
```

### 7.3 Keyboard Navigation

```
[ ] A11Y-008 | Full landing page keyboard navigation works
    Steps:
      1. Navigate to /
      2. Press Tab repeatedly, traversing all interactive elements
    Expected:
      - All nav links, CTA buttons, and footer links are reachable via Tab
      - Tab order is logical (left-to-right, top-to-bottom)
      - No interactive element is skipped
    Pass criteria: All interactive elements focusable via Tab, no keyboard traps

[ ] A11Y-009 | Focus indicators are visible on all interactive elements
    Steps:
      1. Navigate to / via keyboard
      2. Tab through all interactive elements
    Expected: Each focused element has a visible focus ring/outline
    Pass criteria:
      - Focus indicator is visible (not hidden via outline:none without replacement)
      - Focus indicator meets 3:1 contrast ratio against surrounding colors (WCAG 2.4.11)

[ ] A11Y-010 | Mobile menu is keyboard accessible
    Steps:
      1. At 375px width, open hamburger menu
      2. Tab through menu items
    Expected: All menu links focusable, Escape key closes menu
    Pass criteria: Escape closes menu and returns focus to hamburger button

[ ] A11Y-011 | Swiper testimonials can be navigated via keyboard
    Steps:
      1. Focus the testimonials Swiper component
      2. Press Arrow Left / Arrow Right
    Expected: Carousel navigates slides via keyboard
    Pass criteria: Both left and right arrow keys change the displayed testimonial
```

### 7.4 Screen Reader Support

```
[ ] A11Y-012 | Section landmarks are properly marked
    Steps:
      1. Run axe DevTools on /
      2. Check "Landmark" rules
    Expected:
      - <header> for navbar
      - <main> for page content
      - <footer> for footer
      - Each major section has aria-label or is wrapped in <section> with aria-labelledby
    Pass criteria: Zero "Region" landmark violations in axe

[ ] A11Y-013 | Animated text reveal does not confuse screen readers
    Expected: Problem section text is fully readable by screen reader at all times (not hidden during reveal animation)
    Implementation note: Screen readers should receive the full text immediately. Visual animation uses CSS/JS transforms on visible presentation only, not aria-hidden during the reveal.

[ ] A11Y-014 | Carousel autoplay respects prefers-reduced-motion
    Steps:
      1. Enable "Reduce motion" in macOS/iOS Accessibility settings
      2. Navigate to testimonials section
    Expected: Carousel does not autoplay when prefers-reduced-motion is set
    Pass criteria: Testimonials are static or manually navigable only, no motion

[ ] A11Y-015 | All framer-motion animations respect prefers-reduced-motion
    Steps:
      1. Enable prefers-reduced-motion
      2. Navigate to /
    Expected: All scroll-driven animations (word reveal, stagger, parallax) are disabled or instant
    Pass criteria: No transforming or fading elements when reduced motion is enabled
    Implementation: Verified via framer-motion's useReducedMotion() hook returning true and disabling variants
```

---

## 8. Cross-Browser Tests

All tests are run on both the landing page (`/`) and one app page (`/app/meal-plan`).

### 8.1 Desktop Browser Matrix

| Browser | Version | Platform |
|---|---|---|
| Chrome | Latest stable | macOS + Windows |
| Safari | Latest stable | macOS |
| Firefox | Latest stable | macOS + Windows |
| Edge | Latest stable | Windows |

```
[ ] XB-001 | Chrome (latest macOS): landing page renders correctly
[ ] XB-002 | Chrome (latest macOS): all animations play correctly
[ ] XB-003 | Chrome (latest macOS): app pages render in dark mode correctly
[ ] XB-004 | Safari (latest macOS): landing page renders correctly
    Note: Safari-specific items to verify:
      - backdrop-filter (glass navbar) — supported in Safari, but verify visually
      - CSS animation performance on Safari GPU compositing
      - Swiper touch events (Safari has stricter passive event listener requirements)
[ ] XB-005 | Safari (latest macOS): all animations play correctly
    Note: framer-motion uses transform3d — verify Safari does not jank on parallax
[ ] XB-006 | Safari (latest macOS): app pages render in dark mode correctly
[ ] XB-007 | Firefox (latest): landing page renders correctly
    Note: Firefox-specific items to verify:
      - backdrop-filter support — Firefox supports it but with slightly different rendering
      - scrollbar styling (Firefox uses different default scrollbar that may be visible in dark mode)
[ ] XB-008 | Firefox (latest): animations play correctly
[ ] XB-009 | Firefox (latest): app pages in dark mode correct

[ ] XB-010 | Safari: Lenis smooth scroll does not conflict with Safari's built-in momentum scroll
    Expected: Smooth scroll feels natural in Safari (no double-scroll or jank)
[ ] XB-011 | Firefox: CSS custom properties (--color-*) resolve correctly in all components
[ ] XB-012 | All browsers: webp images load correctly
    Note: All modern browsers support WebP. Verify no fallback issues.
```

### 8.2 Mobile Browser Matrix

| Browser | Version | Device |
|---|---|---|
| iOS Safari | Latest | iPhone 15 or equivalent |
| Chrome for Android | Latest | Android device or emulation |

```
[ ] XB-013 | iOS Safari: landing page loads and scrolls smoothly
[ ] XB-014 | iOS Safari: touch swipe on Swiper testimonials works
[ ] XB-015 | iOS Safari: hamburger menu opens and closes correctly
[ ] XB-016 | iOS Safari: hero section is 100dvh (not cut off by browser chrome)
    Note: Use 100dvh (dynamic viewport height) not 100vh to account for Safari's browser chrome
[ ] XB-017 | iOS Safari: Lenis smooth scroll works (verify not conflicting with Safari's inertia scroll)
[ ] XB-018 | Android Chrome: landing page loads and scrolls correctly
[ ] XB-019 | Android Chrome: touch gestures on carousel work
[ ] XB-020 | Android Chrome: no horizontal scroll at 375px viewport
```

---

## 9. Regression Checklist — Existing Features

After Phase 5 (route restructuring) and Phase 2 (dark mode conversion), ALL pre-existing features must be verified to still function. The dark mode conversion and route moves must not introduce regressions.

Navigate to each feature's new `/app/*` route for testing.

### 9.1 Profile Management (CRUD)

```
[ ] REG-001 | Create a new profile
    Steps:
      1. Navigate to /app/profile
      2. Click "Add Profile" or equivalent
      3. Fill in name, age, dietary restrictions, health goals
      4. Submit
    Expected: New profile created, appears in profile list
    Pass criteria: Profile visible in list with correct data

[ ] REG-002 | Read / view profile details
    Steps:
      1. Click on an existing profile
    Expected: Profile details page/modal shows all saved data
    Pass criteria: All fields display correctly — no undefined or null values shown

[ ] REG-003 | Update / edit a profile
    Steps:
      1. Open a profile
      2. Edit name and dietary restrictions
      3. Save
    Expected: Changes persist after page refresh
    Pass criteria:
      - Updated values visible immediately after save
      - Values still correct after browser refresh
      - API returns 200/204 on save (check Network tab)

[ ] REG-004 | Delete a profile
    Steps:
      1. Open a profile
      2. Click "Delete Profile"
      3. Confirm deletion in dialog
    Expected: Profile removed from list
    Pass criteria:
      - Profile no longer appears in list
      - No 500 error
      - If deleted profile was active, system handles gracefully (switches to another or shows empty state)
```

### 9.2 Joint Profile Creation

```
[ ] REG-005 | Create a joint household profile
    Steps:
      1. Navigate to /app/profile
      2. Initiate joint profile creation (combining 2+ individual profiles)
      3. Select family members to include
      4. Save joint profile
    Expected: Joint profile created and visible in profile list
    Pass criteria:
      - Joint profile shows combined member count
      - Individual member profiles remain intact
      - Joint profile is selectable as the active profile for meal planning
```

### 9.3 Meal Plan Generation

```
[ ] REG-006 | Generate a weekly meal plan for a single profile
    Steps:
      1. Navigate to /app/meal-plan
      2. Select an individual profile
      3. Click "Generate Meal Plan" or equivalent
      4. Wait for AI generation (may take 10–30 seconds)
    Expected: 7-day meal plan generated with breakfast, lunch, dinner
    Pass criteria:
      - All 7 days populated
      - Meals are appropriate for the profile's dietary restrictions
      - Indian cuisine meals appear in the plan
      - No loading spinner stuck indefinitely (timeout handled)

[ ] REG-007 | Generate a weekly meal plan for a joint/household profile
    Steps:
      1. Select a joint profile
      2. Generate meal plan
    Expected: Meal plan considers all household members' dietary needs simultaneously
    Pass criteria:
      - Plan generated without error
      - Meals are appropriate for all members (e.g., if one member is diabetic, no high-sugar meals)
```

### 9.4 Meal Swap

```
[ ] REG-008 | Swap a meal in the plan
    Steps:
      1. Navigate to /app/meal-plan
      2. Click on any meal cell
      3. Select "Swap Meal" or equivalent
      4. Choose a replacement from suggestions or generate new
    Expected: Meal is replaced in the plan with the selected alternative
    Pass criteria:
      - Original meal no longer visible in that slot
      - New meal visible in that slot
      - Swap persists after page refresh
```

### 9.5 Custom Meal Replace

```
[ ] REG-009 | Replace a meal with a custom meal entry
    Steps:
      1. Click on a meal cell
      2. Select "Custom Replace" or "Edit Meal"
      3. Enter a custom meal name and details
      4. Save
    Expected: Meal slot shows custom meal entry
    Pass criteria:
      - Custom meal visible in correct slot
      - Custom data persists after refresh
```

### 9.6 Copy Meal

```
[ ] REG-010 | Copy a meal to another day/slot
    Steps:
      1. Click on a meal cell
      2. Select "Copy Meal"
      3. Select target day and meal type (breakfast/lunch/dinner)
      4. Confirm copy
    Expected: Same meal appears in the target slot
    Pass criteria:
      - Target slot now shows copied meal
      - Source slot remains unchanged
      - Copy persists after refresh
```

### 9.7 Kid Sharing / Portion Scaling

```
[ ] REG-011 | Mark a meal as shared with a child
    Steps:
      1. Click on a meal cell
      2. Select "Share with Kid" or equivalent
      3. Select child family member
      4. Confirm
    Expected: Meal shows child-sharing indicator, portion details updated
    Pass criteria:
      - Visual indicator (badge/icon) appears on the meal card
      - Portion size for child is appropriately scaled down
      - Adult portion remains unchanged

[ ] REG-012 | Portion scaling reflects correct values for kid-shared meals
    Expected: Child portion is approximately 50–70% of adult portion (or per system calculation)
    Pass criteria: Calorie/macronutrient values shown for child portion are less than adult values
```

### 9.8 Meal Tracking

```
[ ] REG-013 | Mark a meal as "Planned" status
    Steps:
      1. Navigate to /app/tracking
      2. Find a meal without a tracked status
    Expected: Default status is "Planned"
    Pass criteria: Meal shows planned indicator

[ ] REG-014 | Mark a meal as "Logged" (eaten)
    Steps:
      1. Navigate to /app/tracking
      2. Click status control on a meal
      3. Select "Logged" or "Eaten"
    Expected: Meal status changes to Logged
    Pass criteria:
      - Visual state changes (correct color/icon for Logged)
      - Status persists after page refresh
      - Daily completion counter increments

[ ] REG-015 | Mark a meal as "Skipped"
    Steps:
      1. Navigate to /app/tracking
      2. Change meal status to "Skipped"
    Expected: Meal status shows Skipped state
    Pass criteria:
      - Visual state changes (correct color/icon for Skipped)
      - Status persists after refresh
      - Daily calorie total updates to exclude skipped meal

[ ] REG-016 | All three meal tracking statuses cycle correctly
    Steps:
      1. Test transitioning: Planned → Logged → Skipped → Planned (or each transition individually)
    Expected: Each transition is possible and persists correctly
    Pass criteria: All 3→3 = 9 possible transitions tested, all pass
```

### 9.9 Grocery List

```
[ ] REG-017 | Generate grocery list from meal plan
    Steps:
      1. Navigate to /app/grocery
      2. Click "Generate Grocery List" (from current meal plan)
    Expected: Grocery list populated with ingredients from the current meal plan
    Pass criteria:
      - Items organized by category (Vegetables, Proteins, Dairy, etc.)
      - Quantities are appropriate for the meal plan portion sizes
      - No duplicate items (quantities are consolidated)

[ ] REG-018 | Export grocery list
    Steps:
      1. Navigate to /app/grocery
      2. Click "Export" button
    Expected: Grocery list downloads as a file (PDF or CSV)
    Pass criteria:
      - File downloads to local system
      - File is not empty or corrupted
      - File format is correct (check file extension matches content)
      - All grocery items present in exported file
```

### 9.10 Dashboard Analytics

```
[ ] REG-019 | Dashboard charts render correctly
    Steps:
      1. Navigate to /app/dashboard
      2. Ensure at least 3 days of tracking data exists
    Expected: Charts display historical data
    Pass criteria:
      - All chart types render without error (no "Error loading chart" messages)
      - Charts show real data (not all zeros or empty)
      - Chart tooltips appear on hover with correct values

[ ] REG-020 | Dashboard date range selector updates charts
    Steps:
      1. Change date range filter (e.g., "Last 7 days" to "Last 30 days")
    Expected: Chart data updates to reflect new date range
    Pass criteria:
      - Charts re-render with new data
      - No loading error
      - Data range visible in chart covers the selected period
```

### 9.11 Settings

```
[ ] REG-021 | Settings reset function works correctly
    Steps:
      1. Navigate to /app/settings
      2. Locate "Reset" function (reset meal plan or reset preferences)
      3. Click Reset and confirm in dialog
    Expected: Specified data is cleared
    Pass criteria:
      - Confirmation dialog appears before destructive action
      - After confirmation, data is cleared
      - UI reflects cleared state (empty list or default values)
      - No 500 error on reset API call

[ ] REG-022 | Profile switching from settings or sidebar works
    Steps:
      1. If multiple profiles exist, switch to a different active profile
    Expected: App updates to show the selected profile's data
    Pass criteria:
      - Profile name in sidebar/header updates to new profile
      - Meal plan, tracking, grocery data refreshes for new profile
      - Switch persists across page navigation within the app
```

---

## Appendix A: Test Environment Setup

### Environment Configuration

```bash
# Terminal 1 — Backend
cd /path/to/project/backend
./venv/bin/python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend (development)
cd /path/to/project/frontend
npm run dev
# Opens at http://localhost:3000

# For Lighthouse and performance tests, use production build:
# Terminal 2 alternative
npm run build && npm start
# Also opens at http://localhost:3000
```

### Test Data Requirements

Before running regression tests (Section 9), ensure the following test data exists in the database:

1. At least 2 individual profiles with different dietary restrictions
2. At least 1 joint/household profile combining both individuals
3. A generated meal plan for the current week
4. At least 3 days of tracked meals with mixed statuses
5. At least 1 generated grocery list

### Reporting Defects

Each failing test is logged as:

```
Defect ID: [PHASE]-[SECTION]-[NUMBER]
Example: P1-DARK-DASH-004

Severity: P0 / P1 / P2 / P3
Test Case: TC reference (e.g., DARK-DASH-004)
Steps to reproduce: [exact steps]
Expected result: [what should happen]
Actual result: [what actually happened]
Environment: Browser, OS, viewport width
Screenshot/recording: [attached]
```

---

*End of Document — `spec/ui-redesign/08-verification-testing.md`*
