# AI Image Generation Specification
## FedRight Landing Page — Image Asset Pipeline

**Document Version:** 1.0
**Date:** 2026-02-20
**Project:** FedRight — AI-Powered Household Meal Planning
**Target Market:** Indian families

---

## 1. Overview

This document specifies all 12 AI-generated images required for the FedRight landing page redesign. Images are generated using **Google Gemini Pro** (image generation capability) and saved as production-ready assets.

### Generation Tool
- **Model:** Google Gemini Pro (gemini-2.0-flash-preview-image-generation or equivalent image-capable endpoint)
- **API:** Google AI Studio / Vertex AI
- **Script location:** `scripts/generate-images.ts` (to be created)

### Asset Storage
- **Output directory:** `frontend/public/images/landing/`
- **Primary format:** PNG (lossless, ideal for hero and key images with text overlay)
- **Secondary format:** WebP (auto-generated via `sharp` for all images — Next.js serves WebP automatically)

### Target File Sizes
| Category | Max Size (PNG) | Max Size (WebP) |
|----------|----------------|-----------------|
| Hero / CTA (1200x800) | 500 KB | 250 KB |
| How It Works cards (800x600) | 300 KB | 150 KB |
| Cuisine marquee cards (640x400) | 200 KB | 100 KB |

### Universal Rules for All Images
1. **No text** of any kind embedded in the image (no labels, captions, watermarks, overlays)
2. **No logos** or brand identifiers
3. **No watermarks** — clean, usable output only
4. **Dark-friendly edges** — no stark white borders or white backgrounds; images should transition naturally into a dark (`#0A0A0A`) website background
5. **Photorealistic** — editorial / lifestyle / food photography aesthetic throughout
6. **Indian subjects, settings, and food only** — no Western kitchens, Western faces, or non-Indian food

---

## 2. Image Inventory Table

| # | Filename | Usage | Dimensions (px) | Section | Priority |
|---|----------|-------|-----------------|---------|----------|
| 1 | `hero-family.png` | Hero section — right column image | 1200 x 800 | Hero | Critical (LCP) |
| 2 | `mom-profiles.png` | How It Works — Step 1 card | 800 x 600 | How It Works | High |
| 3 | `dishes-overhead.png` | How It Works — Step 2 card | 800 x 600 | How It Works | High |
| 4 | `fresh-vegetables.png` | How It Works — Step 3 card | 800 x 600 | How It Works | High |
| 5 | `family-eating.png` | How It Works — Step 4 card | 800 x 600 | How It Works | High |
| 6 | `cuisine-punjabi.png` | Cuisine marquee — card 1 | 640 x 400 | Cuisine Marquee | Medium |
| 7 | `cuisine-south-indian.png` | Cuisine marquee — card 2 | 640 x 400 | Cuisine Marquee | Medium |
| 8 | `cuisine-gujarati.png` | Cuisine marquee — card 3 | 640 x 400 | Cuisine Marquee | Medium |
| 9 | `cuisine-bengali.png` | Cuisine marquee — card 4 | 640 x 400 | Cuisine Marquee | Medium |
| 10 | `cuisine-hyderabadi.png` | Cuisine marquee — card 5 | 640 x 400 | Cuisine Marquee | Medium |
| 11 | `cuisine-kerala.png` | Cuisine marquee — card 6 | 640 x 400 | Cuisine Marquee | Medium |
| 12 | `thali-phone-cta.png` | Final CTA section background | 1200 x 800 | Final CTA | High |

---

## 3. Detailed Image Prompts

Each entry below provides the exact Gemini prompt, art direction notes, compositional requirements, cultural nuances, and a fallback description for when AI generation fails or is unavailable.

---

### Image 1: `hero-family.png`
**Section:** Hero
**Dimensions:** 1200 x 800 px
**Role:** Primary hero visual — the first image a visitor sees. This is the Largest Contentful Paint (LCP) element on desktop.

#### Gemini Prompt (exact)
```
A warm, cinematic photograph of a modern Indian family — a mother in her early 30s with dark hair in a loose braid, a father in his mid-30s, a grandmother in her mid-60s wearing a simple cotton saree, and two children (a girl around 12 and a boy around 5) — gathered around a beautifully set wooden dining table in a modern Indian kitchen-dining space. The table has diverse Indian dishes: dal in a brass bowl, roti stacked in a cloth-lined wicker basket, mixed vegetable sabzi in a ceramic bowl, fragrant jeera rice with curry leaves, and a rich chicken curry in a karahi. Warm golden evening light streams through a window from the left side, casting soft shadows and creating a cozy, intimate atmosphere. Shallow depth of field with soft bokeh in the background showing the kitchen cabinets. The family is smiling genuinely — the mother is mid-action serving food onto the young boy's plate. Shot from a slightly elevated angle (about 15 degrees above eye level). Photorealistic, editorial lifestyle photography, clean composition with the family centered. Aspect ratio 3:2.
```

#### Art Direction
- **Mood:** Warm, aspirational, premium — like a lifestyle magazine cover or a Godrej/Titan advertisement
- **Lighting:** Golden hour interior — warm 3200K colour temperature, not harsh overhead fluorescents
- **Colour palette:** Warm ambers, deep browns, saffron yellows, with pops of green (coriander) and red (curry)
- **Depth:** Foreground food slightly soft, family in sharp focus, background slightly blurred — creates cinematic depth

#### Key Requirements
- Every person must present as ethnically Indian (South Asian features, complexion, attire)
- Grandmother must wear a saree — this is culturally important and aspirational for the target market
- The kitchen should look modern Indian: granite countertops, steel vessels, perhaps a pressure cooker visible in the background — NOT a Western open-plan kitchen with stainless steel appliances
- Food must be clearly recognisable as Indian (dal, roti, sabzi, jeera rice, curry) — not generic "Asian food"
- The mother serving food is a universal Indian family moment — this gesture must be clear

#### What to Avoid
- No text, labels, or captions anywhere in the image
- No Western clothing (no jeans visible at the table, no t-shirts with English logos)
- No pizza, pasta, burgers, or any non-Indian food on the table
- No overly bright white backgrounds or stark white walls (must integrate with dark website)
- No stock photo "staged" feeling — expressions must be natural

#### Dark-Mode Compatibility
- Background should naturally be slightly dark (evening light, shadowed kitchen) — this image will sit on a `#0A0A0A` background; harsh white edges will create jarring halos
- Consider a subtle vignette in post if needed

#### Fallback (if generation fails)
Use a stock photo from Unsplash/Pexels with search terms: "Indian family dinner table warm light". Accept only images with Indian subjects, warm lighting, and dark enough background tones. Apply a subtle darkening vignette around edges to blend with the dark site.

---

### Image 2: `mom-profiles.png`
**Section:** How It Works — Step 1 ("Set Up Your Family Profiles")
**Dimensions:** 800 x 600 px
**Role:** Illustrates the action of a mom setting up family profiles on a phone

#### Gemini Prompt (exact)
```
A modern Indian woman in her early 30s, with dark hair worn loosely, dressed in a comfortable cotton kurta top in a muted teal or grey colour, sitting cross-legged on a plush sofa in a contemporary Indian living room. She is looking down at her smartphone held in both hands with a warm, contented smile — as if she has just completed a satisfying task. The living room background has subtle Indian decorative elements: a small brass diya on a side table, a vibrant cushion in deep blue or mustard yellow, a green potted plant near the window. Soft, diffused natural daylight from a window to her left. Lifestyle photography, photorealistic, shallow depth of field with background pleasantly blurred. The phone screen is not visible — it faces her. Warm, aspirational, modern Indian home aesthetic.
```

#### Art Direction
- **Mood:** Relatable and warm — a modern, tech-savvy Indian mom, not a corporate or glamorous portrayal
- **Lighting:** Soft natural daylight, not harsh studio lighting
- **Composition:** Woman slightly off-centre (rule of thirds), negative space on the right for potential text overlay if needed

#### Key Requirements
- Woman must appear Indian (South Asian features, traditional kurta)
- Phone screen must not be visible (prevents any content conflicts with the UI shown in the actual app)
- Living room decor must include at least one clearly Indian element (brass diya, traditional textile, rangoli, etc.)
- Expression should be satisfied / calm, not ecstatic or over-performed

#### What to Avoid
- Western decor (no IKEA-style minimalism, no posters in English)
- Corporate/office settings
- Visible phone screen with any content
- Overly glamorous or formal styling

#### Fallback
Stock photo: Indian woman on sofa with phone, warm tones, casual kurta. Apply subtle darkening at edges.

---

### Image 3: `dishes-overhead.png`
**Section:** How It Works — Step 2 ("AI Generates Your Weekly Plan")
**Dimensions:** 800 x 600 px
**Role:** Represents the diversity and richness of Indian meal options the AI plans from

#### Gemini Prompt (exact)
```
Stunning overhead flat-lay photograph of a diverse Indian meal spread on a dark matte wooden table. Dishes arranged artfully include: butter chicken (murgh makhani) in a black matte stone bowl with a swirl of cream on top, dal makhani in a small copper karahi with a pat of butter melting, four pieces of garlic naan arranged in a gentle fan shape, a mound of fragrant jeera rice with golden fried onions and fresh coriander on top, palak paneer in a small brass bowl with a cube of paneer visible, cucumber raita with roasted cumin powder and mint garnish in a white ceramic bowl, and two golden gulab jamun on a small dark plate. Fresh coriander sprigs and two halved green chilies scattered as garnish. Dramatic moody side lighting from the left creating deep shadows and highlights that make the food textures pop. Steam wisps rising softly from the butter chicken and dal. Professional food photography, dark editorial aesthetic. Black and dark brown background dominant.
```

#### Art Direction
- **Mood:** Moody, premium food editorial — think Bon Appétit magazine but for Indian food
- **Lighting:** Single strong side light source from the left, creating dramatic shadows (Rembrandt-style for food)
- **Colour:** Dark background is essential — the rich ambers, reds, and greens of the food must contrast sharply against near-black

#### Key Requirements
- Dark background (very dark brown or near-black) is mandatory — this image lives on a dark website
- Steam wisps add life and warmth — must be present on hot dishes
- Every dish must be clearly recognisable as an Indian dish
- No cutlery of non-Indian type (use spoons only, no forks/knives prominently placed)
- Overhead (90 degrees directly above) composition

#### What to Avoid
- White or light backgrounds
- Non-Indian food items
- Text overlays or labels on dishes
- Cheesy smiley-face food arrangements

#### Fallback
Professional Indian food flat-lay from stock with dark background. Must include at least 4 distinct Indian dishes. Apply darkening vignette at edges.

---

### Image 4: `fresh-vegetables.png`
**Section:** How It Works — Step 3 ("Get Your Grocery List")
**Dimensions:** 800 x 600 px
**Role:** Represents the fresh ingredients that go into the generated grocery list

#### Gemini Prompt (exact)
```
Beautiful arrangement of fresh Indian vegetables and whole spices on a dark natural slate surface, styled as a professional food editorial photograph. Include: a generous bunch of fresh coriander (dhaniya) with roots still attached and water droplets on leaves, bright emerald green finger chilies, four ripe red tomatoes (one halved showing seeds), two large golden onions (one halved showing layers), a small white cauliflower broken into florets, a full stem of fresh curry leaves, a knobby turmeric root (haldi) broken to show bright orange interior, a thick piece of ginger root, a small brass bowl filled with black mustard seeds, a small brass bowl filled with cumin (jeera) seeds, three dried red chilies, two bright yellow lemons, and a few garlic cloves. Items arranged loosely but artfully — not perfectly symmetrical. Dramatic moody side lighting from the right creating deep shadows. Water droplets on the vegetables for freshness. Dark slate/stone background. Vibrant, saturated colours popping against the darkness. Professional food photography, shallow depth of field with centre items in sharpest focus.
```

#### Art Direction
- **Mood:** Farm-to-table premium editorial — the freshness and authenticity of Indian cooking ingredients
- **Lighting:** Side rim lighting to highlight textures of vegetables
- **Colour:** High contrast — vivid greens, reds, yellows, whites against near-black slate

#### Key Requirements
- Must include specifically Indian ingredients (curry leaves, turmeric root, green chilies, coriander with roots — not parsley)
- Brass bowls for spices — culturally Indian
- Slate or dark stone surface (not white marble, not light wood)
- Water droplets on at least coriander and tomatoes

#### What to Avoid
- Western vegetables (broccoli, bell peppers, zucchini) as dominant items
- Light backgrounds
- Overly styled / unrealistic arrangements

#### Fallback
Stock photo of Indian vegetables / spice flat-lay with dark background. Must include coriander, chilies, and whole spices.

---

### Image 5: `family-eating.png`
**Section:** How It Works — Step 4 ("Track, Adjust, Thrive")
**Dimensions:** 800 x 600 px
**Role:** Shows the happy outcome — a family thriving together at the dinner table

#### Gemini Prompt (exact)
```
A joyful, candid-feeling moment of an Indian family sharing a meal together at a wooden dining table in their modern Indian home. The scene shows two parents (early-to-mid 30s) and two children (a teenage girl around 14 and a young boy around 7). The mother is mid-laugh while the young boy dramatically shows her his empty plate, pleased with himself. The father is watching with an amused smile. The teenage girl is reaching across the table for roti. Plates of roti, rice, and curry are visible on the table along with steel glasses of water. Warm golden evening light from a window to the right bathes the scene in amber tones. Modern Indian home interior — warm-toned walls, perhaps a framed piece of art visible in the background. Photorealistic, lifestyle photography with natural, unposed expressions. Shallow depth of field. Aspect ratio 4:3.
```

#### Art Direction
- **Mood:** Authentic joy, not advertisement-perfect smiles — genuine family warmth
- **Lighting:** Warm golden evening light — consistent with Image 1 (hero) to maintain visual coherence across the "How It Works" section
- **Composition:** Horizontal framing showing all four family members interacting

#### Key Requirements
- Indian family (South Asian features and attire)
- Indian food on the table
- Natural, unposed expressions — candid moment
- Modern Indian home (not Western, not traditional village)
- The interaction between mother and young child showing empty plate is the hero moment

#### What to Avoid
- Stiff, posed, stock-photo body language
- Non-Indian food
- Overly bright or clinical lighting

#### Fallback
Stock photo: Indian family laughing at dinner table with Indian food. Warm tones. Apply edge darkening.

---

### Image 6: `cuisine-punjabi.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents Punjabi cuisine in the scrolling marquee strip

#### Gemini Prompt (exact)
```
Authentic Punjabi food spread beautifully arranged on a dark matte surface from an overhead angle: a copper bowl of golden chole (chickpea curry) with a garnish of sliced onion rings and green coriander, two large fluffy bhature on a white plate with a crispy texture visible, a small karahi of creamy butter chicken with a cream swirl, a tall brass or copper glass of sweet lassi with a thick cream top and a pinch of saffron, and three golden paneer tikka cubes on wooden skewers with visible char marks. A small bowl of mint-coriander chutney on the side. Dramatic warm side lighting from the left, steam rising from the chole. Dark wood or stone background. Professional food photography, high contrast, vibrant colours.
```

#### Art Direction
- Overhead shot, tight composition fitting 640x400
- Warm amber and gold colour tones — Punjabi food is rich and hearty; the image should feel indulgent

#### Fallback
Stock: Chole bhature or butter chicken on dark background.

---

### Image 7: `cuisine-south-indian.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents South Indian cuisine

#### Gemini Prompt (exact)
```
Traditional South Indian meal served on a fresh, vibrant green banana leaf placed on a dark surface, overhead angle. On the leaf: a large crispy golden dosa (masala dosa) folded diagonally showing the crispy edge texture, two soft white idlis with slightly moist surfaces, a small stainless steel katori of steaming dark sambar, a small mound of white coconut chutney with a curry leaf and mustard seed tempering swirled on top, a small mound of bright red tomato chutney, and a traditional stainless steel tumbler of dark filter coffee with a matching dabara (saucer bowl) beside it. Dramatic cool-warm contrast lighting. Dark background. Professional food photography.
```

#### Art Direction
- The green banana leaf must be vibrant — it is the signature element of South Indian food presentation
- Contrast between dark background and bright green leaf is the compositional anchor

#### Fallback
Stock: South Indian thali on banana leaf, dark background.

---

### Image 8: `cuisine-gujarati.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents Gujarati cuisine

#### Gemini Prompt (exact)
```
Colourful Gujarati thali served on a round shiny steel (kansa) plate placed on a dark stone surface, overhead angle. On the thali: soft spongy dhokla squares with a visible mustard seed and curry leaf tempering, three layered thepla (fenugreek flatbread) folded and stacked, a bowl of mixed undhiyu (mixed winter vegetables) in a rich brown gravy, a small bowl of golden turmeric dal, a mound of steamed white rice, a single rotli (thin chapati). Small satellite bowls around the plate hold green mango pickle (keri no athano), a white mukhwas (fennel seeds with coloured sugar pearls). A small green chili alongside. Bright, colourful, inviting. Dramatic overhead lighting. Dark background. Professional food photography.
```

#### Art Direction
- Gujarati food is famously sweet-savoury and colourful — the image should feel cheerful and abundant
- Steel thali is the cultural centrepiece

#### Fallback
Stock: Gujarati thali on steel plate, overhead, dark background.

---

### Image 9: `cuisine-bengali.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents Bengali cuisine

#### Gemini Prompt (exact)
```
Bengali meal styled as professional food photography on a dark slate surface, overhead angle. Scene includes: macher jhol (Bengali fish curry with potato and tomato pieces) in a round terracotta bowl, the curry a thin golden-turmeric colour with mustard oil visible on the surface; two classic mishti doi (sweet yogurt) in small unglazed terracotta clay pots with slightly caramelised tops; two golden fried luchi (deep-fried flatbread) puffed and crispy on a white plate; two pieces of crispy begun bhaja (fried eggplant slices) with a turmeric crust; and a mound of steamed white fragrant rice. A few green chilies and a small brass container of mustard oil as props. Dramatic moody side lighting. Dark background. Professional editorial food photography.
```

#### Art Direction
- The terracotta pots for mishti doi are culturally iconic — must be present
- Mustard oil in a small vessel reinforces the Bengali culinary identity

#### Fallback
Stock: Bengali fish curry (macher jhol) or mishti doi in terracotta pots, dark background.

---

### Image 10: `cuisine-hyderabadi.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents Hyderabadi cuisine

#### Gemini Prompt (exact)
```
Hyderabadi biryani served dramatically in an ornate hammered copper handi (pot) placed on a dark marble surface, shot from a 45-degree angle (not straight overhead). The copper lid is partially open, steam visibly escaping, revealing inside: layers of fragrant long-grain basmati rice tinted with saffron (deep yellow and white layers), pieces of meat partially visible, fried onion (birista) scattered on top, a few mint leaves. Alongside the handi: a small white ceramic bowl of cooling cucumber raita with a sprinkle of cumin and paprika, a small bowl of vibrant green-yellow mirchi ka salan (chili curry in peanut sauce), and one or two crispy papad. Dramatic chiaroscuro lighting — one strong light source creating deep copper reflections and shadows. Dark background. Cinematic, editorial food photography.
```

#### Art Direction
- The copper handi is the hero prop — must be prominently ornate
- Steam from the partially opened lid is the most important visual element — conveys heat and aroma
- Chiaroscuro (dramatic light-dark) lighting matches the royal Hyderabadi aesthetic

#### Fallback
Stock: Hyderabadi biryani in copper handi, steaming, dark background.

---

### Image 11: `cuisine-kerala.png`
**Section:** Cuisine Marquee
**Dimensions:** 640 x 400 px
**Role:** Represents Kerala cuisine

#### Gemini Prompt (exact)
```
Kerala food spread on a dark surface, overhead angle with slight tilt. Includes: two lacy white appam (fermented rice hoppers with crispy edges and soft spongy centres) on a traditional brass plate, a clay pot (manchatti) of golden fish molee — fish in a coconut milk curry with green chilies, curry leaves visible; a round brass bowl of avial (mixed vegetables in coconut and yogurt sauce, visually colourful with green beans, carrot, and banana visible); a banana leaf section with a small mound of ada pradhaman payasam (rice flakes in jaggery and coconut milk) with a garnish; and a traditional brass serving plate. Coconut pieces (broken half), fresh curry leaves, and a green chili as props. Warm tropical-toned lighting. Dark background. Professional food photography.
```

#### Art Direction
- Kerala cuisine is characterized by coconut, curry leaves, and clay/brass vessels — all three must appear
- The clay pot (manchatti) is culturally distinctive
- Banana leaf element ties it to Kerala traditions

#### Fallback
Stock: Kerala sadya or appam with stew, dark background, brass vessels.

---

### Image 12: `thali-phone-cta.png`
**Section:** Final CTA
**Dimensions:** 1200 x 800 px
**Role:** Background / hero visual for the final call-to-action section ("Start Your Free Trial")

#### Gemini Prompt (exact)
```
Overhead photograph of a beautiful, abundantly filled Indian thali — a large round steel plate with 8 to 10 small matching steel katoris (bowls) arranged around the rim, each containing different dishes: a rich red curry, golden dal, white raita, dark chutney, pale yellow rice, a small sweet (halwa), a piece of papad, and a wedge of lemon — with rotis folded on the side of the main plate. The thali is placed on a dark polished wooden table. Casually beside the thali (not centred, placed naturally as if someone set it down to eat), a modern black Android smartphone with its screen dark/off faces up. The phone is at a slight angle (about 20 degrees off parallel to the thali). Warm golden side lighting from the upper-left casting rich shadows across the bowls and creating highlights on the steel. Shallow depth of field — thali in sharp focus, phone edges slightly soft. Professional food photography, editorial quality, moody dark aesthetic. Aspect ratio 3:2.
```

#### Art Direction
- The thali is the star, the phone is a supporting prop — their relationship communicates "plan your meals on your phone"
- Phone screen must be dark/off (no screen glare, no content visible)
- The image will have a semi-transparent dark overlay applied in CSS for the CTA text to remain readable — this means the image can be somewhat bright/rich in colour

#### Key Requirements
- Full thali with at least 8 filled katoris
- Phone placed naturally, not centred or forced
- Dark table surface, not light
- Indian food in all bowls

#### What to Avoid
- iPhone with Apple logo (use a generic/Android phone or ensure logo is not visible)
- Empty thali
- Bright white table

#### Fallback
Stock: Indian thali overhead on dark background, with smartphone nearby. Apply darkening gradient overlay in CSS.

---

## 4. Image Optimization Pipeline

After AI generation, all images must go through this pipeline before committing to the repository.

### Step 1: Resize to Target Dimensions
Use `sharp` (Node.js) or ImageMagick:

```bash
# Using sharp CLI (install: npm install -g sharp-cli)
sharp -i hero-family-raw.png -o hero-family.png resize 1200 800

# Or using ImageMagick
convert hero-family-raw.png -resize 1200x800^ -gravity center -extent 1200x800 hero-family.png
```

### Step 2: Compress PNG
```bash
# Using pngquant for lossy PNG compression
pngquant --quality=80-95 --output hero-family.png -- hero-family-raw.png

# Or oxipng for lossless PNG optimization
oxipng -o 4 --strip safe hero-family.png
```

### Step 3: Generate WebP Versions
```bash
# Using sharp CLI
sharp -i hero-family.png -o hero-family.webp --format webp --quality 85

# Using cwebp
cwebp -q 85 hero-family.png -o hero-family.webp
```

### Step 4: Generate Blur Placeholders (Base64)
For each image, generate a 10x10 blurred thumbnail as a base64 string for `placeholder="blur"` in Next.js Image:

```typescript
// scripts/generate-blur-placeholders.ts
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const images = [
  'hero-family',
  'mom-profiles',
  'dishes-overhead',
  'fresh-vegetables',
  'family-eating',
  'cuisine-punjabi',
  'cuisine-south-indian',
  'cuisine-gujarati',
  'cuisine-bengali',
  'cuisine-hyderabadi',
  'cuisine-kerala',
  'thali-phone-cta',
];

async function generateBlurPlaceholder(filename: string): Promise<string> {
  const inputPath = path.join('frontend/public/images/landing', `${filename}.png`);
  const buffer = await sharp(inputPath)
    .resize(10, 10, { fit: 'cover' })   // Tiny thumbnail
    .blur(1)
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function main() {
  const placeholders: Record<string, string> = {};
  for (const name of images) {
    placeholders[name] = await generateBlurPlaceholder(name);
    console.log(`Generated blur placeholder for: ${name}`);
  }
  // Write to a TS constants file for import in components
  const output = `// Auto-generated by scripts/generate-blur-placeholders.ts
// Re-run after updating images in public/images/landing/
export const blurPlaceholders = ${JSON.stringify(placeholders, null, 2)} as const;
`;
  fs.writeFileSync('frontend/src/lib/image-blur-placeholders.ts', output);
  console.log('Written to: frontend/src/lib/image-blur-placeholders.ts');
}

main();
```

### Step 5: Verify Dark-Mode Edge Compatibility
Open each image in a browser against a `#0A0A0A` background and visually confirm:
- No white or near-white halos at image edges
- Colour tones blend naturally into the dark background
- No artificial borders

If halos exist, apply a subtle edge vignette in `sharp`:

```typescript
// Add a vignette overlay to prevent white-edge halo
await sharp(inputPath)
  .composite([{
    input: Buffer.from(`
      <svg width="${width}" height="${height}">
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stop-color="black" stop-opacity="0"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.6"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#vignette)"/>
      </svg>
    `),
    blend: 'multiply',
  }])
  .toFile(outputPath);
```

### Step 6: Verify File Sizes
```bash
ls -lah frontend/public/images/landing/
# Confirm no PNG exceeds 500KB, no WebP exceeds 250KB
```

---

## 5. Next.js Image Configuration

Update `frontend/next.config.ts` (or `next.config.js`) with the following to enable automatic WebP/AVIF serving and proper responsive sizing:

```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Next.js will serve WebP or AVIF automatically to browsers that support them,
    // falling back to the original PNG. No manual WebP conversion needed in <Image/> usage.
    formats: ['image/avif', 'image/webp'],

    // Breakpoints at which Next.js generates resized versions for responsive images.
    // Matches common mobile (640, 750, 828), tablet (1080), desktop (1200, 1920) sizes.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],

    // Sizes for images that are NOT full-viewport-width (e.g., cards, thumbnails).
    // The <Image sizes="..."> prop must be set correctly to benefit from these.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Minimum cache TTL for optimized images (seconds). 30 days.
    minimumCacheTTL: 2592000,
  },
};

export default nextConfig;
```

---

## 6. Usage in Components

### 6.1 Hero Image (Image 1 — Above the Fold)
```typescript
// frontend/src/components/landing/HeroSection.tsx
import Image from 'next/image';
import { blurPlaceholders } from '@/lib/image-blur-placeholders';

export function HeroSection() {
  return (
    <div className="relative w-full h-[500px] md:h-[640px]">
      <Image
        src="/images/landing/hero-family.png"
        alt="An Indian family gathered around a dinner table, sharing a warm meal together"
        fill                          // Fill the parent container
        priority                      // CRITICAL: above-the-fold LCP image; preloaded immediately
        quality={90}                  // Higher quality for hero
        sizes="(max-width: 768px) 100vw, 50vw"  // 50% of viewport on desktop
        placeholder="blur"
        blurDataURL={blurPlaceholders['hero-family']}
        className="object-cover object-center"
      />
    </div>
  );
}
```

### 6.2 How It Works Cards (Images 2–5)
```typescript
// Each card in the How It Works section
import Image from 'next/image';
import { blurPlaceholders } from '@/lib/image-blur-placeholders';

// step.imageKey is one of: 'mom-profiles' | 'dishes-overhead' | 'fresh-vegetables' | 'family-eating'
<div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
  <Image
    src={`/images/landing/${step.imageKey}.png`}
    alt={step.imageAlt}
    fill
    // No priority — these are below the fold; default lazy loading is correct
    quality={85}
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
    placeholder="blur"
    blurDataURL={blurPlaceholders[step.imageKey]}
    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
  />
</div>
```

### 6.3 Cuisine Marquee Cards (Images 6–11)
```typescript
// Marquee cards scroll infinitely — keep downloads small
// sizes="256px" means Next.js will download the 256px-wide version, not a large desktop version
import Image from 'next/image';

<div className="relative w-64 h-40 rounded-lg overflow-hidden flex-shrink-0">
  <Image
    src={`/images/landing/cuisine-${cuisine.slug}.png`}
    alt={`${cuisine.name} cuisine — authentic Indian dishes`}
    fill
    loading="lazy"                   // Explicit lazy load (default, but explicit for clarity)
    quality={80}                     // Slightly lower quality acceptable for smaller cards
    sizes="256px"                    // IMPORTANT: prevents downloading 1200px version for a 256px card
    placeholder="blur"
    blurDataURL={blurPlaceholders[`cuisine-${cuisine.slug}`]}
    className="object-cover object-center"
  />
</div>
```

### 6.4 CTA Background Image (Image 12)
```typescript
// CTA section — full bleed background with dark overlay for text readability
<section className="relative overflow-hidden min-h-[500px]">
  {/* Background image layer */}
  <div className="absolute inset-0 z-0">
    <Image
      src="/images/landing/thali-phone-cta.png"
      alt=""                         // Decorative background — empty alt is correct
      fill
      quality={85}
      sizes="100vw"
      placeholder="blur"
      blurDataURL={blurPlaceholders['thali-phone-cta']}
      className="object-cover object-center"
    />
    {/* Semi-transparent dark overlay to ensure text contrast — min 4.5:1 WCAG ratio */}
    <div className="absolute inset-0 bg-black/65" aria-hidden="true" />
  </div>

  {/* CTA content layer — sits above image */}
  <div className="relative z-10 flex flex-col items-center justify-center min-h-[500px] px-6 text-center">
    {/* CTA text and button */}
  </div>
</section>
```

---

## 7. Placeholder Strategy

For three scenarios: (a) AI generation is pending, (b) image failed to generate, (c) image is loading in-browser.

### 7.1 In-Browser Loading (Always Active)
```typescript
// Implemented via placeholder="blur" + blurDataURL on all <Image> components (see Section 6).
// The blurDataURL renders immediately as a pixelated preview while the full image downloads.
// Generated by scripts/generate-blur-placeholders.ts (see Section 4, Step 4).
```

### 7.2 Missing Image File (Development)
Create CSS gradient placeholder cards that match the dark theme. Add to `frontend/src/components/landing/ImagePlaceholder.tsx`:

```typescript
// frontend/src/components/landing/ImagePlaceholder.tsx
// Used during development when image files are not yet available.
// Replace with real <Image> components once assets are generated.

interface ImagePlaceholderProps {
  label: string;
  aspectRatio?: string;          // Tailwind aspect ratio class, e.g. "aspect-[3/2]"
  gradient?: string;             // Tailwind gradient, e.g. "from-amber-900/40 to-orange-900/20"
}

export function ImagePlaceholder({
  label,
  aspectRatio = 'aspect-[3/2]',
  gradient = 'from-neutral-900 to-neutral-800',
}: ImagePlaceholderProps) {
  return (
    <div
      className={`
        relative w-full ${aspectRatio} rounded-xl overflow-hidden
        bg-gradient-to-br ${gradient}
        flex items-center justify-center
        border border-white/5
      `}
    >
      <span className="text-white/20 text-sm font-mono">{label}</span>
    </div>
  );
}
```

Per-image gradient suggestions:
| Image | Gradient |
|-------|----------|
| hero-family | `from-amber-950/60 to-orange-950/40` |
| mom-profiles | `from-teal-950/60 to-neutral-900/80` |
| dishes-overhead | `from-red-950/60 to-amber-950/40` |
| fresh-vegetables | `from-green-950/60 to-neutral-900/80` |
| family-eating | `from-amber-950/50 to-yellow-950/30` |
| cuisine-punjabi | `from-orange-950/60 to-red-950/40` |
| cuisine-south-indian | `from-green-950/60 to-lime-950/40` |
| cuisine-gujarati | `from-yellow-950/60 to-amber-950/40` |
| cuisine-bengali | `from-yellow-900/50 to-orange-950/40` |
| cuisine-hyderabadi | `from-amber-950/60 to-yellow-950/40` |
| cuisine-kerala | `from-green-950/60 to-teal-950/40` |
| thali-phone-cta | `from-amber-950/50 to-red-950/30` |

### 7.3 Runtime Error Fallback (Production)
Wrap all image-containing components with an error boundary that silently renders the gradient placeholder if the image fails to load in production:

```typescript
// In each image component, handle onError:
<Image
  src="/images/landing/hero-family.png"
  onError={() => setImageError(true)}
  // ... other props
/>
{imageError && <ImagePlaceholder label="" gradient="from-amber-950/60 to-orange-950/40" />}
```

---

## 8. Generation Script

The following script automates calling the Gemini API for all 12 images.

```typescript
// scripts/generate-landing-images.ts
// Run with: cd frontend && npx ts-node scripts/generate-landing-images.ts
// Requires: GOOGLE_AI_API_KEY in environment

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

const OUTPUT_DIR = path.join(__dirname, '../public/images/landing');

interface ImageSpec {
  filename: string;
  prompt: string;
  width: number;
  height: number;
}

// See Section 3 for full prompt text — abbreviated here for script structure
const images: ImageSpec[] = [
  { filename: 'hero-family.png',          width: 1200, height: 800, prompt: '/* See Section 3, Image 1 */' },
  { filename: 'mom-profiles.png',         width: 800,  height: 600, prompt: '/* See Section 3, Image 2 */' },
  { filename: 'dishes-overhead.png',      width: 800,  height: 600, prompt: '/* See Section 3, Image 3 */' },
  { filename: 'fresh-vegetables.png',     width: 800,  height: 600, prompt: '/* See Section 3, Image 4 */' },
  { filename: 'family-eating.png',        width: 800,  height: 600, prompt: '/* See Section 3, Image 5 */' },
  { filename: 'cuisine-punjabi.png',      width: 640,  height: 400, prompt: '/* See Section 3, Image 6 */' },
  { filename: 'cuisine-south-indian.png', width: 640,  height: 400, prompt: '/* See Section 3, Image 7 */' },
  { filename: 'cuisine-gujarati.png',     width: 640,  height: 400, prompt: '/* See Section 3, Image 8 */' },
  { filename: 'cuisine-bengali.png',      width: 640,  height: 400, prompt: '/* See Section 3, Image 9 */' },
  { filename: 'cuisine-hyderabadi.png',   width: 640,  height: 400, prompt: '/* See Section 3, Image 10 */' },
  { filename: 'cuisine-kerala.png',       width: 640,  height: 400, prompt: '/* See Section 3, Image 11 */' },
  { filename: 'thali-phone-cta.png',      width: 1200, height: 800, prompt: '/* See Section 3, Image 12 */' },
];

async function generateImage(spec: ImageSpec): Promise<void> {
  console.log(`Generating: ${spec.filename}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-preview-image-generation',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: spec.prompt }] }],
    generationConfig: {
      // @ts-expect-error — image generation config is Gemini-specific
      responseModalities: ['image'],
    },
  });

  const parts = result.response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error(`No content returned for ${spec.filename}`);

  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      const imageData = Buffer.from(part.inlineData.data, 'base64');
      const outputPath = path.join(OUTPUT_DIR, spec.filename);
      fs.writeFileSync(outputPath, imageData);
      console.log(`  Saved: ${outputPath} (${(imageData.length / 1024).toFixed(1)} KB raw)`);
      return;
    }
  }

  throw new Error(`No image data in response for ${spec.filename}`);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process sequentially to avoid rate limiting
  for (const spec of images) {
    try {
      await generateImage(spec);
      // Polite delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(`  ERROR generating ${spec.filename}:`, err);
      // Continue with remaining images; don't abort the whole batch
    }
  }

  console.log('\nAll images generated. Now run the optimization pipeline (Section 4).');
}

main();
```

---

*End of Document — AI Image Generation Specification*
