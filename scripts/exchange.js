import 'dotenv/config';
import fetch from 'node-fetch';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const {
  APP_ID,
  APP_SECRET,
  SHORT_LIVED_USER_TOKEN,
  GRAPH_VERSION = 'v19.0'
} = process.env;

if (!APP_ID || !APP_SECRET || !SHORT_LIVED_USER_TOKEN) {
  console.error('Missing APP_ID, APP_SECRET, or SHORT_LIVED_USER_TOKEN in .env');
  process.exit(1);
}

const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
url.searchParams.set('grant_type', 'fb_exchange_token');
url.searchParams.set('client_id', APP_ID);
url.searchParams.set('client_secret', APP_SECRET);
url.searchParams.set('fb_exchange_token', SHORT_LIVED_USER_TOKEN);

try {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const { access_token, token_type, expires_in } = data;

  await mkdir('tokens', { recursive: true });
  const out = {
    token_type,
    long_lived_user_token: access_token,
    expires_in_seconds: expires_in,
    acquired_at: new Date().toISOString()
  };
  await writeFile(path.join('tokens', 'long_lived_user.json'), JSON.stringify(out, null, 2));

  const masked = access_token ? access_token.slice(0, 6) + '...' + access_token.slice(-6) : '(none)';
  console.log('✅ Long-lived user token acquired.');
  console.log(`   Expires in ~${Math.round(expires_in/86400)} days`);
  console.log(`   Saved to tokens/long_lived_user.json`);
  console.log(`   Preview: ${masked}`);
} catch (err) {
  console.error('❌ Exchange failed:', err.message || err);
  process.exit(1);
}

