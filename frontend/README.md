# AI Personal Meal Planner - Frontend

Complete Next.js 15 frontend application for the AI Personal Meal Planner with TypeScript, Tailwind CSS, and Recharts.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend API running at `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at **http://localhost:3000**

### Build for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Home page (redirects)
│   ├── profile/           # Profile management
│   ├── meal-plan/         # Weekly meal plan
│   ├── tracking/          # Daily meal tracking
│   ├── grocery/           # Grocery list
│   └── dashboard/         # Analytics dashboard
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Layout components
│   ├── meal-plan/         # Meal plan features
│   ├── tracking/          # Tracking features
│   ├── grocery/           # Grocery list features
│   └── dashboard/         # Dashboard charts
├── lib/
│   ├── api.ts             # API client
│   └── utils.ts           # Utility functions
└── types/
    └── index.ts           # TypeScript definitions
```

## Features

### Profile Management
- Create and edit user health profile
- Set dietary preferences and restrictions
- Define cooking preferences and skill level
- Automatic nutrition target calculation

### Meal Planning
- AI-generated weekly meal plans
- Swap individual meals with alternatives
- Regenerate specific days or entire week
- Detailed recipes with ingredients and instructions
- Nutrition information per meal

### Meal Tracking
- Track daily meal consumption
- Mark meals as eaten, skipped, or replaced
- Log alternative meals with custom nutrition
- View planned vs actual nutrition totals
- Navigate through past/future dates

### Grocery Lists
- Auto-generate from meal plans
- Organized by category (Produce, Protein, etc.)
- Check off items as you shop
- Progress tracking
- Collapsible categories

### Analytics Dashboard
- Calorie tracking chart (planned vs actual)
- Macro nutrient comparison
- Meal adherence pie chart
- Consistency score with visual indicator
- Export data to Excel

## Technology Stack

- **Framework**: Next.js 15.x with App Router
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: Tailwind CSS 4.x
- **Charts**: Recharts 3.x
- **HTTP**: Axios 1.x
- **Icons**: Lucide React
- **React**: 19.x

## Environment Variables

The `.env.local` file is already configured:

```bash
# Backend API URL (default: http://localhost:8000/api/v1)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Enable debug logging (optional)
NEXT_PUBLIC_DEBUG=true
```

## Pages

- **/** - Auto-redirects based on profile status
- **/profile** - Create/edit user profile
- **/meal-plan** - View and manage weekly meal plan
- **/tracking** - Track daily meal consumption
- **/grocery** - View and manage grocery list
- **/dashboard** - Analytics and progress visualization

## Development

### Testing the Application

1. **Start Backend**: Ensure backend API is running at port 8000
2. **Start Frontend**: Run `npm run dev`
3. **Create Profile**: Navigate to /profile and fill out all sections
4. **Generate Meal Plan**: Go to /meal-plan and click "Generate"
5. **Track Meals**: Use /tracking to log daily consumption
6. **View Grocery List**: Generate list in /grocery
7. **Check Dashboard**: View analytics in /dashboard

### Code Quality
- ESLint enabled with Next.js config
- TypeScript strict mode
- No unused variables/imports
- Proper error boundaries

## Common Issues

### API Connection Errors
- Verify backend is running at `http://localhost:8000`
- Check `.env.local` has correct API URL
- Ensure CORS is enabled on backend

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (must be 18+)

## Implementation Details

See `IMPLEMENTATION_SUMMARY.md` for complete details on all files created and architecture decisions.
