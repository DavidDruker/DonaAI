# DonaAI

DonaAI is a mobile AI personal assistant prototype built with Expo and React Native. It helps a user draft email, review their schedule, create reminders, and coordinate calendar actions through a conversational interface.

This repo is prepared as a portfolio project with a deployed demo path through Supabase and Render. The app includes real integration paths for Supabase, Gmail, Google Calendar, device calendar/reminders, and a Node backend that plans assistant actions with Gemini.

## Highlights

- Expo and React Native mobile app for iOS, Android, and web development builds
- Portfolio demo path with Supabase auth/storage and a Render-hosted backend
- Supabase authentication, user preferences, and contacts
- Gmail OAuth connection through a Node backend
- Google Calendar event creation and schedule summaries
- Device calendar/reminder permission checks through Expo Calendar
- Gemini-backed intent planning for chat, email, reminder, and calendar requests
- Email draft preview before sending, with a configurable send-directly option
- Render-ready backend configuration and Supabase schema

## Demo Flow

The intended portfolio demo uses Supabase for auth/data and Render for the backend:

1. Deploy the backend to Render.
2. Configure Supabase using `supabase/schema.sql`.
3. Set the mobile app environment to the Render backend and Supabase project.
4. Create a test/demo account in Supabase.
5. Run the Expo app and log in with that demo account.
6. Explore the Schedule, Contacts, and Chat tabs.
7. Try prompts like:
   - `Review my day`
   - `Remind me to send the proposal`
   - `Email Maya a quick project update`

For a portfolio post, pair this with screenshots or a short screen recording so reviewers do not need to install the app just to understand the project.

## Tech Stack

- **Mobile:** Expo SDK 54, React Native, React 19
- **Backend:** Node.js HTTP server
- **Auth and data:** Supabase Auth, Postgres tables, Row Level Security
- **AI planning:** Gemini API
- **Integrations:** Gmail API, Google Calendar API, Expo Calendar
- **Deployment:** Render blueprint for the backend

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start the backend:

```bash
npm run backend
```

For local backend testing, this opens the API at:

```text
http://127.0.0.1:8787
```

For the portfolio demo, point `EXPO_PUBLIC_BACKEND_URL` at the Render URL instead of localhost.

Start Expo:

```bash
npx expo start --clear
```

Open the app with Expo Go, an emulator, or a development build.

## Environment

For the deployed demo path, configure:

```text
EXPO_PUBLIC_BACKEND_URL=https://YOUR-RENDER-BACKEND
EXPO_PUBLIC_PORTFOLIO_MODE=false
EXPO_PUBLIC_DISABLE_SUPABASE=false
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-SUPABASE-ANON-KEY
```

Backend services also need:

- `BACKEND_PUBLIC_URL`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Use `.env.example` as the source of truth for variable names.

## Backend Deployment

The backend can be deployed to Render with `render.yaml`.

After deployment:

1. Set the backend environment variables in Render.
2. Add this Google OAuth redirect URI in Google Cloud:

```text
https://YOUR-BACKEND-URL/auth/google/callback
```

3. Update the mobile app environment:

```text
EXPO_PUBLIC_BACKEND_URL=https://YOUR-BACKEND-URL
BACKEND_PUBLIC_URL=https://YOUR-BACKEND-URL
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND-URL/auth/google/callback
```

See [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md) for the longer deployment checklist.

## Project Structure

```text
backend/server.js              Node backend, OAuth, Gemini action planning, Google APIs
src/DonaAIApp.js               Main mobile app shell
src/components/                Auth, configuration, contacts, schedule UI
src/services/                  Supabase, email, assistant, contacts, device access helpers
supabase/schema.sql            Database tables and RLS policies
render.yaml                    Render backend blueprint
```

## What Is Real

- Real Supabase auth, preferences, and contact storage when configured
- Real Gmail OAuth and token persistence through the backend when configured
- Real Google Calendar reads/writes when Google access is connected
- Real iOS/Android calendar and reminder permission checks through Expo Calendar
- Real Gemini action planning when `GEMINI_API_KEY` is present

## Portfolio Notes

Before posting publicly, add:

- 3 to 6 screenshots or a short screen recording
- A live backend URL if you want reviewers to test real integrations
- A short case-study paragraph explaining the problem, constraints, and design choices
- A privacy note if you invite people to connect real Google accounts

This is a portfolio-grade prototype, not an app-store-ready consumer product. App-store release would require Google OAuth verification, a privacy policy, account deletion flows, production monitoring, and support processes.
