# Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Facebook App Configuration
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
NEXT_PUBLIC_FACEBOOK_APP_VERSION=v18.0

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Supabase Credentials

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy the Project URL and anon/public key
4. Keep the service role key secure

## Getting Facebook App Credentials

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Facebook Login and Messenger Platform products
3. Copy the App ID and App Secret
4. Configure OAuth redirect URIs to include your app URL + `/api/auth/callback`

