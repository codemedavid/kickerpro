import 'dotenv/config';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import path from 'path';

const { APP_ID, APP_SECRET, GRAPH_VERSION = 'v19.0' } = process.env;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing APP_ID or APP_SECRET in .env');
  process.exit(1);
}

async function readLongLived() {
  const p = path.join('tokens', 'long_lived_user.json');
  const json = JSON.parse(await readFile(p, 'utf-8'));
  return json.long_lived_user_token;
}

try {
  const userToken = await readLongLived();
  if (!userToken) throw new Error('No long_lived_user_token found.');

  const appAccessToken = `${APP_ID}|${APP_SECRET}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
  url.searchParams.set('input_token', userToken);
  url.searchParams.set('access_token', appAccessToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  // Keep console output concise (no secrets)
  const { data: d } = data;
  console.log('✅ Token verification');
  console.log({
    is_valid: d?.is_valid,
    type: d?.type,
    app_id: d?.app_id,
    application: d?.application,
    user_id: d?.user_id,
    scopes: d?.scopes,
    expires_at_epoch: d?.expires_at,
  });
} catch (err) {
  console.error('❌ Verification failed:', err.message || err);
  process.exit(1);
}

