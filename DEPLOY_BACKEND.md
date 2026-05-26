# Deploy the Backend

This project can keep using Expo Go while the backend runs at a permanent public URL.

The goal is to replace temporary `trycloudflare.com` links with one stable URL, such as:

```text
https://secretary-backend.onrender.com
```

Then Google OAuth uses one permanent redirect URI:

```text
https://secretary-backend.onrender.com/auth/google/callback
```

## Render Setup

1. Push this project to GitHub.
2. Go to Render and create a new **Blueprint** or **Web Service** from the repo.
3. If using a Web Service manually:
   - Runtime: `Node`
   - Build command: `npm install`
   - Start command: `npm run backend`
   - Health check path: `/health`

## Environment Variables

Add these in the hosting provider dashboard:

```text
NODE_ENV=production
HOST=0.0.0.0
BACKEND_PUBLIC_URL=https://YOUR-BACKEND-URL
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND-URL/auth/google/callback
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=https://YOUR-SUPABASE-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GOOGLE_TOKEN_ENCRYPTION_KEY=a-long-random-secret-for-token-encryption
```

Do not upload `.env`. Use the hosting provider's environment variable screen.

## Google Cloud

In Google Cloud Console, add this exact authorized redirect URI to the OAuth client:

```text
https://YOUR-BACKEND-URL/auth/google/callback
```

## Expo App

After the backend is deployed, update local `.env`:

```text
EXPO_PUBLIC_BACKEND_URL=https://YOUR-BACKEND-URL
BACKEND_PUBLIC_URL=https://YOUR-BACKEND-URL
GOOGLE_REDIRECT_URI=https://YOUR-BACKEND-URL/auth/google/callback
```

Then restart Expo with cache clear:

```powershell
npx expo start --clear --go --lan -p 8081
```

## Current Limitation

The backend stores Google OAuth sessions in Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. Stored Google tokens are encrypted before they are written to Supabase. Set `GOOGLE_TOKEN_ENCRYPTION_KEY` to a long random secret; if it is not set, the backend falls back to `GOOGLE_CLIENT_SECRET` for encryption.

Run `supabase/schema.sql` in the Supabase SQL editor before deploying the Supabase-backed backend.
