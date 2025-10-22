# Facebook Bulk Messenger - Next.js Edition

A modern, scalable web application for managing Facebook Messenger campaigns with bulk messaging, scheduling, analytics, and team collaboration features. Built with Next.js 15, Supabase, and TypeScript.

## ✨ Features

- **🔐 Secure Authentication** - Facebook OAuth integration with Supabase Auth
- **📱 Facebook Page Management** - Connect and manage multiple Facebook pages
- **💬 Bulk Messaging** - Send personalized messages to multiple recipients
- **📅 Smart Scheduling** - Schedule messages for optimal engagement times
- **📊 Real-time Analytics** - Track delivery rates, open rates, and engagement metrics
- **👥 Team Collaboration** - Manage team members with role-based permissions
- **🔔 Webhook Integration** - Real-time message notifications from Facebook
- **🎨 Modern UI** - Beautiful, responsive design with Shadcn UI and Tailwind CSS
- **⚡ Server-Side Rendering** - Fast page loads with Next.js App Router
- **🛡️ Type Safety** - Full TypeScript support throughout

## 🚀 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth + Facebook OAuth
- **UI Components:** Shadcn UI + Radix UI
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Form Validation:** Zod
- **Date Handling:** date-fns
- **Icons:** Lucide React

## 📋 Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase account ([supabase.com](https://supabase.com))
- Facebook Developer account ([developers.facebook.com](https://developers.facebook.com))

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nextjs-app
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL Editor
3. Get your project URL and anon key from Project Settings > API

### 4. Set Up Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app or use an existing one
3. Add **Facebook Login** and **Messenger Platform** products
4. Configure OAuth redirect URIs:
   - Add `http://localhost:3000/api/auth/callback` for development
   - Add your production URL + `/api/auth/callback` for production
5. Get your App ID and App Secret from App Settings > Basic

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

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

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** The project uses Tailwind CSS v3 for compatibility with Shadcn UI. If you see CSS errors, ensure you're using Tailwind v3, not v4.

## 📁 Project Structure

```
nextjs-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   └── webhook/      # Facebook webhook handler
│   │   ├── dashboard/        # Dashboard pages
│   │   ├── login/            # Login page
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── components/            # React components
│   │   ├── dashboard/        # Dashboard-specific components
│   │   └── ui/               # Shadcn UI components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions
│   │   └── supabase/         # Supabase client utilities
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets
├── supabase-schema.sql       # Database schema
├── ENV_SETUP.md              # Environment setup guide
└── README.md                 # This file
```

## 🔧 Configuration

### Database Schema

The application uses the following main tables:

- **users** - User accounts
- **facebook_pages** - Connected Facebook pages
- **messages** - Message campaigns
- **messenger_conversations** - Message history
- **team_members** - Team collaboration
- **message_activity** - Activity logs

### Facebook Permissions Required

The app requests these Facebook permissions:

- `pages_manage_posts` - Post to pages
- `pages_read_engagement` - Read page engagement
- `pages_messaging` - Send messages
- `pages_show_list` - List pages
- `email` - User email (optional)

### Webhook Setup

1. In your Facebook App, go to Messenger > Settings
2. Add a webhook with your app URL + `/api/webhook`
3. Use the verify token from your `.env.local`
4. Subscribe to these webhook fields:
   - `messages`
   - `messaging_postbacks`
   - `message_deliveries`
   - `message_reads`

## 🎯 Usage

### Composing Messages

1. Navigate to **Compose Message** from the dashboard
2. Select a Facebook page
3. Write your message (use `{first_name}` and `{last_name}` for personalization)
4. Choose to send immediately, schedule, or save as draft
5. Select recipients (all followers or active users only)
6. Send or schedule your message

### Managing Pages

1. Go to **Facebook Pages**
2. Click **Connect New Page**
3. Authenticate with Facebook
4. Select pages to connect
5. Manage or disconnect pages as needed

### Viewing Analytics

- Dashboard shows overview statistics
- Message History displays detailed delivery metrics
- Recent Activity tracks all campaign actions

## 🚀 Deployment

### Deploying to Vercel

1. Push your code to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Deploy!

### Post-Deployment

1. Update Facebook App OAuth redirect URIs with your production URL
2. Update webhook URL in Facebook App settings
3. Test authentication and webhook functionality

## 📝 Facebook Messaging Policies

This application is designed to comply with Facebook's messaging policies:

- **24-Hour Window** - Messages can only be sent to users who contacted your page within 24 hours
- **No Spam** - Messages must provide value to recipients
- **User Consent** - Only message users who initiated contact
- **Rate Limiting** - Built-in delays to prevent API rate limiting

## 🔒 Security Best Practices

- Never commit `.env.local` or expose API keys
- Use HTTPS in production
- Regularly rotate access tokens
- Review Facebook's security guidelines
- Keep dependencies updated
- Implement proper error handling
- Monitor API usage and rate limits

## 🐛 Troubleshooting

### Authentication Issues

- Verify Facebook App ID and Secret are correct
- Check OAuth redirect URIs match exactly
- Ensure Supabase URL and keys are valid
- Clear browser cookies and try again

### Webhook Not Receiving Events

- Verify webhook URL is publicly accessible
- Check verify token matches in Facebook and .env.local
- Ensure webhook is subscribed to correct events
- Review Facebook App Dashboard for errors

### Database Errors

- Confirm Supabase schema is properly installed
- Check Row Level Security (RLS) policies
- Verify user permissions in Supabase

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational purposes. Please comply with:
- Facebook's Platform Terms and Policies
- Messenger Platform Policy
- Data Privacy Regulations (GDPR, CCPA, etc.)

## 🆘 Support

For issues and questions:
- Check the troubleshooting section
- Review Facebook's Messenger Platform documentation
- Check Supabase documentation
- Review Next.js documentation

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**⚠️ Important:** This application is designed for legitimate business use. Always follow Facebook's policies and respect user privacy.
# kickerpro
