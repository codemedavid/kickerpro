import 'dotenv/config';
import fetch from 'node-fetch';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const { GRAPH_VERSION = 'v19.0' } = process.env;

async function readLongLived() {
  const p = path.join('tokens', 'long_lived_user.json');
  const json = JSON.parse(await readFile(p, 'utf-8'));
  return json.long_lived_user_token;
}

try {
  const userToken = await readLongLived();
  if (!userToken) throw new Error('No long_lived_user_token found.');

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  url.searchParams.set('access_token', userToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  await mkdir('tokens', { recursive: true });
  await writeFile(path.join('tokens', 'page_tokens.json'), JSON.stringify(data, null, 2));

  const list = (data.data || []).map(p => ({
    page_name: p.name,
    page_id: p.id,
    perms: p.perms,
    // Do NOT print token values
  }));

  console.log('✅ Retrieved Page tokens/metadata for pages you manage.');
  console.table(list);
  console.log('   Full response saved to tokens/page_tokens.json');
} catch (err) {
  console.error('❌ Fetching pages failed:', err.message || err);
  process.exit(1);
}

