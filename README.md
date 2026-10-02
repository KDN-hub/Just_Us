# Just Us

> **Private, 2-person chat & calling PWA — not for public use.**

Just Us is an intimate communication app built for exactly two people.
It provides private messaging, voice/video calling, and a shared space
designed around a couple's relationship.

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Framework   | Next.js 14 (App Router)         |
| Language    | TypeScript                       |
| Styling     | Tailwind CSS                     |
| Backend     | Supabase (auth, database, realtime) |
| PWA         | next-pwa                        |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in your Supabase credentials
#    (a .env.local with placeholders already exists)

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  onboarding/          Welcome → Profile → PIN setup → Together-since
  login/               PIN entry
  chat/                Main chat screen
  call/                In-call screen
lib/
  supabase.ts          Supabase client initialisation
components/
  PinPad.tsx           Numeric PIN keypad
  MessageBubble.tsx    Chat message bubble
  Avatar.tsx           User avatar with fallback
```

## Status

🚧 **Skeleton only** — routing and empty page shells are in place.
No business logic, real-time messaging, or calling has been implemented yet.

## License

This is a private project. Not open-sourced or intended for redistribution.
