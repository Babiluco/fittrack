# FitTrack Authentication

FitTrack uses Supabase Auth for real user accounts. This sprint implements email and password authentication only.

## Supabase Setup

1. Create a Supabase project.
2. In `js/config.js`, set:
   - `CONFIG.SUPABASE.URL`
   - `CONFIG.SUPABASE.PUBLISHABLE_KEY`
3. Use only the public anon/publishable key in the frontend.
4. Never commit a `service_role` key or any admin/secret key.

Static HTML apps do not have safe private environment variables in browser code. For this version, the public Supabase configuration is isolated in `js/config.js`.

## Required Auth Settings

In Supabase Dashboard:

1. Enable Email provider under Authentication.
2. Decide whether email confirmation is required.
3. Add the app URL to allowed redirect URLs.
4. For GitHub Pages, add both:
   - `https://YOUR_USER.github.io/YOUR_REPOSITORY/`
   - `https://YOUR_USER.github.io/YOUR_REPOSITORY/index.html`
5. For local testing, add the local file/server URL you use.

## Flow

On startup, FitTrack checks the Supabase browser session.

If authenticated, the app opens normally.

If not authenticated, FitTrack shows the login experience.

The Supabase session is the source of truth. FitTrack does not use a custom `loggedIn` flag in `localStorage`.

## Module Responsibilities

`js/supabase.js` initializes the Supabase client once.

`js/auth.js` exposes:

- `signUp()`
- `signIn()`
- `signOut()`
- `getCurrentUser()`
- `getSession()`
- `isAuthenticated()`
- `resetPassword()`
- `updatePassword()`
- `onAuthStateChange()`

Other app files should use `AUTH`, not direct `supabase.auth` calls.

## Password Reset

The user requests a reset email from the login screen. Supabase sends the email using the configured redirect URL. When the user follows the link, FitTrack handles the recovery session and shows the new password screen.

## Existing Local Data

This sprint does not migrate data to the cloud.

Local data remains local:

- workouts
- workout history
- active workout
- measurements
- goals
- achievements
- exercise history
- settings

Logging in or out does not delete local data.

## Future Migration Point

The next data sprint can associate local data with `AUTH.getCurrentUser().id` and upload it through a deliberate migration flow. Do not automatically upload existing local data without an explicit user-controlled migration step.

## Security Notes

- No passwords are stored in FitTrack state.
- No passwords are saved in localStorage by app code.
- No service role key belongs in this repository.
- Client-side authentication is not authorization for future database access. Future Supabase tables must use Row Level Security policies.
