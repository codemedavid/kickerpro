# Facebook Token Management Tools

Node.js scripts to manage Facebook long-lived tokens for your app.

## Prerequisites

- Node.js >= 18
- Facebook App ID and App Secret from [Meta for Developers](https://developers.facebook.com/)
- A short-lived user access token (from OAuth login flow or Graph API Explorer)

## Setup

1. **Configure your environment variables**
   
   Edit the `.env` file and add your credentials:
   ```bash
   APP_ID=your_actual_app_id
   APP_SECRET=your_actual_app_secret
   SHORT_LIVED_USER_TOKEN=your_short_lived_token_from_graph_explorer
   GRAPH_VERSION=v19.0  # Optional: update to match your app's version
   ```

## Usage

### 1. Exchange for Long-Lived Token

Exchange your short-lived token for a long-lived one (~60 days):

```bash
npm run exchange
```

This will:
- Call Facebook's `oauth/access_token` endpoint
- Save the long-lived token to `tokens/long_lived_user.json`
- Display a masked preview and expiry info

### 2. Verify Your Token

Verify the long-lived token is valid:

```bash
npm run verify
```

This will:
- Call Facebook's `debug_token` endpoint
- Display token metadata (validity, scopes, expiry, etc.)

### 3. Get Page Tokens (Optional)

Fetch page access tokens for pages you manage:

```bash
npm run pages
```

This will:
- Call Facebook's `me/accounts` endpoint
- Save page tokens to `tokens/page_tokens.json`
- Display a table of page names and IDs (tokens are not printed)

## Files Created

```
├── .env                          # Your credentials (gitignored)
├── .env.example                  # Template for credentials
├── package.json                  # Dependencies and scripts
├── scripts/
│   ├── exchange.js              # Exchange short-lived → long-lived token
│   ├── verify.js                # Verify token validity
│   └── pages.js                 # Fetch page tokens
└── tokens/                      # Generated tokens (gitignored)
    ├── long_lived_user.json     # Your long-lived user token
    └── page_tokens.json         # Your page tokens
```

## Important Notes

- **Long-lived user tokens** expire in ~60 days
- **Page tokens** derived from user sessions can be invalidated by security events or role changes
- Always verify tokens with `npm run verify` before use
- If your app is in **development mode**, only app admins/developers/testers can generate tokens
- Update `GRAPH_VERSION` in `.env` to match your app's pinned Graph API version
- Never commit `.env` or `tokens/` directory to version control

## Alternative: cURL Commands

If you prefer using cURL directly:

### Exchange token:
```bash
curl -G "https://graph.facebook.com/v19.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=$APP_ID" \
  --data-urlencode "client_secret=$APP_SECRET" \
  --data-urlencode "fb_exchange_token=$SHORT_LIVED_USER_TOKEN"
```

### Verify token:
```bash
curl -G "https://graph.facebook.com/v19.0/debug_token" \
  --data-urlencode "input_token=$LONG_LIVED_USER_TOKEN" \
  --data-urlencode "access_token=${APP_ID}|${APP_SECRET}"
```

### List pages:
```bash
curl -G "https://graph.facebook.com/v19.0/me/accounts" \
  --data-urlencode "access_token=$LONG_LIVED_USER_TOKEN"
```

## Troubleshooting

- **"Missing APP_ID, APP_SECRET, or SHORT_LIVED_USER_TOKEN"**: Make sure you've filled in the `.env` file with real values
- **Exchange fails**: Check that your short-lived token is valid and hasn't expired
- **Verification fails**: Ensure the long-lived token was created successfully
- **No pages returned**: Make sure your user account manages at least one Facebook page

## Security

- Secrets are never printed to console (only masked previews)
- `.env` and `tokens/` are added to `.gitignore` automatically
- Always keep your `APP_SECRET` confidential

