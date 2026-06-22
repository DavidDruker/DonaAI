# DonaAI Portfolio Posting Checklist

Use this before sharing the repo, adding it to your portfolio, or posting it as a project.

## Done In This Repo

- Public app name is DonaAI.
- The main app file is `src/DonaAIApp.js`.
- Expo metadata uses the DonaAI name, slug, scheme, and package IDs.
- `.env.example` is sanitized and contains placeholders only.
- README is rewritten for portfolio viewers.
- Supabase/Render demo path is documented.
- Backend deployment docs use generic DonaAI URLs.

## You Still Need To Add

1. Screenshots or a short video
   - Login/auth screen
   - Schedule tab
   - Contacts tab
   - Chat prompt and email draft preview

2. Portfolio case-study copy
   - Problem: busy users need a single assistant surface for email, calendar, and reminders.
   - Role: mobile app, backend, integrations, auth, and AI orchestration.
   - Stack: Expo, React Native, Node, Supabase, Google APIs, Gemini.
   - Outcome: working prototype with a deployed Supabase/Render demo path.

3. Live demo setup
   - Deploy the backend to Render.
   - Configure Supabase and Google OAuth.
   - Add the backend URL to your `.env`.
   - Create a safe Supabase demo account with non-private data.
   - Keep the Google OAuth app in testing mode unless you complete verification.

4. Privacy and safety notes
   - Do not ask public reviewers to connect real Gmail unless you have a privacy policy.
   - Mention that the public demo account uses sample/non-private data only.
   - Keep `.env` private and never commit service role keys.

5. Production work if you ever want app-store release
   - Google OAuth verification
   - Privacy policy and terms
   - Account deletion flow
   - Error monitoring and audit logs
   - Secure key rotation process
   - App icons, splash screen, and store assets
