# Secretary Mobile

A first-stage iOS/Android prototype for an AI personal secretary. The app is built with Expo and React Native so the same codebase can run on both platforms while the product direction is still forming.

This project currently targets Expo SDK 54 to match the Expo Go version available on iOS.

## Run It

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start --clear --lan -p 8081
```

Then open the app with Expo Go on iOS/Android, or run:

```bash
npm run ios
npm run android
```

If the QR code times out on a phone, try tunnel mode:

```bash
npx expo start --clear --tunnel
```

## Current Scope

- Simple dark React Native mobile UI
- Real device calendar permission check through `expo-calendar`
- Real iOS reminders permission check through `expo-calendar`
- Gmail/Microsoft OAuth launch flow for email authorization
- No mock inbox, event, or reminder data

## Email OAuth

Create a local `.env` file from `.env.example`:

```bash
EXPO_PUBLIC_BACKEND_URL=http://YOUR_COMPUTER_LAN_IP:8787
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_CLIENT_SECRET=your-google-web-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback
BACKEND_PUBLIC_URL=http://localhost:8787
```

For phone testing through Expo Go, use an HTTPS tunnel and add its callback URL to Google. The current `.env.example` uses a temporary Cloudflare tunnel URL.

Start a Cloudflare quick tunnel:

```bash
tools\cloudflared.exe tunnel --protocol http2 --url http://localhost:8787
```

Use the generated `https://...trycloudflare.com` URL in:

```bash
EXPO_PUBLIC_BACKEND_URL=https://your-tunnel.trycloudflare.com
BACKEND_PUBLIC_URL=https://your-tunnel.trycloudflare.com
GOOGLE_REDIRECT_URI=https://your-tunnel.trycloudflare.com/auth/google/callback
```

Google should use this authorized redirect URI:

```text
https://your-tunnel.trycloudflare.com/auth/google/callback
```

Start the backend:

```bash
npm run backend
```

Then start Expo:

```bash
npx expo start --clear --lan -p 8081
```

This backend flow lets Expo Go test Gmail connection because Google redirects to the backend page, not directly back into the mobile app.

The current backend stores tokens in memory for development only. Production needs encrypted token storage, user accounts, refresh handling, and provider review/compliance.

## Gemini Reminders

The text prompt is handled by the backend. Add a Gemini API key to `.env`:

```bash
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

When you type a prompt, the backend asks Gemini to return a structured action. The phone creates reminders through iOS Reminders, the backend creates Google Calendar events through the Google Calendar API, and the backend can send Gmail messages through the Gmail API.

Example prompts:

- `Remind me to call Alex tomorrow at 9am`
- `Remind me Friday at 2pm to send the invoice`
- `Set a reminder tonight at 8 to take out the trash`
- `Schedule coffee with Maya tomorrow at 2pm`
- `Add a calendar event Friday at 10am for budget review`
- `Send an email to alex@example.com saying I will be 10 minutes late`
- `Email maya@example.com with subject Budget review and tell her I moved it to Friday`

For Google Calendar events, enable **Google Calendar API** in the same Google Cloud project and reconnect Google so the new calendar permission is granted. Gmail sending uses the existing **Gmail API** and `gmail.send` scope, so reconnect Google if the send permission was added after your first sign-in.

## Project Shape

- `index.js` registers the Expo app.
- `src/SecretaryApp.js` is the current mobile app screen.
- `src/services/deviceAccess.js` handles device permission checks.

## Next Steps

- Add OAuth backend for Gmail and Microsoft email.
- Add provider calendar connectors for Google Calendar and Microsoft Calendar.
- Add AI tool-calling once access tokens are available.
- Add persistence with a backend database.
- Add push notifications for reminders.
