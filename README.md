
md
# Inbox Command Center

A custom Gmail & Google Calendar Dashboard MVP that allows users to manage and view their emails, events, and calendar items in one place.

## Features

- **Onboarding Flow**: Connect Gmail and Google Calendar accounts
- **Dashboard**: View your daily/weekly highlights from Gmail & Calendar
- **Email Management**: View, filter, tag, and compose emails
- **Calendar Integration**: View and manage your Google Calendar events
- **Customizable Sidebar**: With pins and priority sections
- **Tag System**: Organize emails with custom tags

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Google APIs (Gmail, Calendar, Drive)
- Make (Integromat) for real-time syncing
- Supabase for metadata and user-defined tags storage

## Getting Started

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd inbox-command-center

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Project Structure

- `/app`: Next.js app router pages
- `/components`: Reusable React components
  - `/dashboard`: Dashboard-specific components
  - `/emails`: Email-related components
  - `/calendar`: Calendar view components
  - `/sidebar`: Sidebar components
  - `/onboarding`: Onboarding flow components
  - `/ui`: UI components (shadcn/ui)
- `/lib`: Utility functions, hooks, and SQL schema
- `/public`: Static assets

## Environment Variables

Create a `.env` file and add the following:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
VITE_GOOGLE_API_KEY=
```

## Google API Setup

1. **Enable the following APIs in Google Cloud Console**:
   - Gmail API
   - Google Calendar API

2. **Add OAuth Scopes to Consent Screen**:

   ```
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.labels',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
   ```

3. **Create OAuth 2.0 Credentials**:
   - Generate a Client ID and Client Secret
   - Add the redirect URI:
     ```
     https://<your-supabase-project>.supabase.co/auth/v1/callback
     ```

4. **Configure Supabase Auth**:
   - Go to **Supabase Dashboard > Auth > Providers > Google**
   - Add the Client ID and Client Secret
   - Enable the provider
   - Add the redirect URI:

## Supabase Database Setup

1. Open the file: `lib/schema.sql`
2. Copy its content and paste it into Supabase SQL Editor
3. Run the SQL to create the required tables


## License

MIT


