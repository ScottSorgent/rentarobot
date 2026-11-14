# Rent-A-Robot — Robot Rental Platform

A commercial and residential robot rental platform. Customers browse a fleet of robots (humanoids, welding arms, warehouse AMRs, inspection quadrupeds, robot vacuums, companion robots), compare daily/weekly pricing, book rentals with instant quotes, and look up their bookings by email.

Built with React + TypeScript + Vite + Tailwind CSS, backed by Supabase (PostgreSQL) for the robot catalog and booking records.

## Features

- **Robot catalog** with commercial and residential categories, real photos, specs, ratings and locations
- **Search and filters** across names, use cases and service cities
- **Robot detail pages** with full specifications and included features
- **Booking flow** with automatic daily/weekly rate calculation and instant quotes
- **Booking lookup** — customers retrieve their rentals by email
- **Responsive design** — works across phones, tablets and desktops

## Tech stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 18, TypeScript, Tailwind CSS  |
| Icons      | Lucide React                        |
| Backend    | Supabase (PostgreSQL + RLS)         |
| Build tool | Vite                                |

## Getting started

```bash
npm install
npm run dev
```

### Environment

Create a `.env` file in the project root with your Supabase project credentials:

```
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Database

The schema lives in `supabase/migrations/` — a `robots` catalog table and a `bookings` table, both with row level security enabled.

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run preview    # preview production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Project structure

```
src/
├── components/
│   ├── CatalogPage.tsx      # hero, fleet grid, search/filters, how-it-works
│   ├── RobotDetailPage.tsx  # robot detail + booking form
│   └── BookingsPage.tsx     # booking lookup by email
├── lib/
│   ├── supabase.ts          # Supabase client singleton
│   ├── api.ts               # fetch/insert queries
│   └── types.ts             # shared types + pricing helpers
└── App.tsx                  # view routing (catalog / detail / bookings)

supabase/
└── migrations/              # schema: robots + bookings tables, RLS, seed data
```

## Pricing model

Each robot has a daily rate and a weekly rate. Quotes combine them: full weeks bill at the weekly rate, remaining days bill at the daily rate (e.g. 10 days = 1 week + 3 days).

## License

All rights reserved.
