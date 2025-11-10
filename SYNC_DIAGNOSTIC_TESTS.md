# 🔬 CONVERSATION SYNC - COMPREHENSIVE DIAGNOSTIC

## 🎯 Running All Tests to Find Why Not All Conversations Fetch

---

## TEST 1: Facebook API Response Check

### Run this in browser console:
```javascript
// Test 1: Check what Facebook actually returns
const pageId = 'YOUR_FACEBOOK_PAGE_ID';
const token = 'YOUR_ACCESS_TOKEN';

// Test without filters
fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?limit=10&access_token=${token}`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ TEST 1 RESULTS:');
    console.log('Conversations returned:', data.data?.length);
    console.log('Has next page:', !!data.paging?.next);
    console.log('Sample conversation:', data.data?.[0]);
    console.log('Full response:', data);
  });
```

**Expected:** Should return conversations
**If Error:** Check token expiration or permissions

---

## TEST 2: Pagination Chain Check

### Check if pagination stops prematurely:
```javascript
// Test 2: Follow pagination manually
let allConversations = [];
let nextUrl = `https://graph.facebook.com/v18.0/${pageId}/conversations?limit=100&access_token=${token}`;
let pageCount = 0;

async function fetchAll() {
  while (nextUrl && pageCount < 150) {  // Safety limit: 150 pages = 15,000 conversations
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);
    
    const response = await fetch(nextUrl);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error);
      break;
    }
    
    allConversations.push(...(data.data || []));
    nextUrl = data.paging?.next || null;
    
    console.log(`Page ${pageCount}: ${data.data?.length} conversations (total: ${allConversations.length})`);
    
    if (!nextUrl) {
      console.log('✅ Reached end of pagination');
      break;
    }
  }
  
  console.log('✅ TEST 2 RESULTS:');
  console.log('Total pages:', pageCount);
  console.log('Total conversations:', allConversations.length);
  return allConversations;
}

fetchAll();
```

**Expected:** Should fetch all pages until no next URL
**Watch for:** Stops before all pages fetched

---

## TEST 3: Participant Filtering Check

### Check if participants are being skipped:
```javascript
// Test 3: Analyze participant data
fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?fields=participants&limit=10&access_token=${token}`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ TEST 3 RESULTS:');
    data.data?.forEach((conv, i) => {
      const participants = conv.participants?.data || [];
      console.log(`Conversation ${i}:`, {
        totalParticipants: participants.length,
        participants: participants.map(p => ({
          id: p.id,
          name: p.name,
          isPage: p.id === pageId
        }))
      });
    });
  });
```

**Expected:** Each conversation should have 1-2 participants
**Watch for:** 
- All participants are the page itself (should skip)
- Missing participant data

---

## TEST 4: Database Insert Success Rate

### Check if database inserts are failing:
```sql
-- Run in Supabase SQL Editor

-- Test 4A: Check for constraint violations
SELECT 
  COUNT(*) as total_conversations,
  COUNT(DISTINCT sender_id) as unique_senders,
  COUNT(DISTINCT page_id) as pages
FROM messenger_conversations;

-- Test 4B: Check for recent sync attempts
SELECT 
  name,
  last_synced_at,
  EXTRACT(EPOCH FROM (NOW() - last_synced_at))/60 as minutes_since_sync
FROM facebook_pages
ORDER BY last_synced_at DESC;

-- Test 4C: Check for duplicate constraint issues
SELECT 
  page_id,
  sender_id,
  COUNT(*) as duplicate_count
FROM messenger_conversations
GROUP BY page_id, sender_id
HAVING COUNT(*) > 1;
```

**Expected:** 
- No duplicates
- Recent last_synced_at
- Conversations growing after each sync

---

## TEST 5: Timeout Detection

### Check if sync is timing out:
```javascript
// Test 5: Monitor sync with timing
const startTime = Date.now();
let lastUpdate = startTime;

fetch('/api/conversations/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pageId: 'your-page-id',
    facebookPageId: 'your-fb-page-id',
    forceFull: true
  })
})
.then(r => {
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`✅ TEST 5 RESULTS:`);
  console.log(`Response received after: ${elapsed}s`);
  
  if (elapsed > 270) {
    console.warn('⚠️ WARNING: Close to timeout limit (270s)');
  }
  
  return r.json();
})
.then(data => {
  console.log('Sync result:', data);
})
.catch(err => {
  const elapsed = (Date.now() - startTime) / 1000;
  console.error(`❌ TIMEOUT/ERROR after ${elapsed}s:`, err);
});
```

**Expected:** Complete in <270 seconds
**Watch for:** Timeout around 270-300 seconds

---

## TEST 6: Incremental vs Full Sync

### Test both modes:
```sql
-- Test 6A: Clear last sync to force full sync
UPDATE facebook_pages 
SET last_synced_at = NULL 
WHERE facebook_page_id = 'YOUR_FB_PAGE_ID';

-- Then run sync and check results
```

```javascript
// Test 6B: Run full sync
const testFullSync = async () => {
  console.log('Testing FULL sync...');
  
  const response = await fetch('/api/conversations/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageId: 'your-page-id',
      facebookPageId: 'your-fb-page-id',
      forceFull: true
    })
  });
  
  const data = await response.json();
  console.log('✅ FULL SYNC RESULTS:', data);
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test incremental sync
  console.log('Testing INCREMENTAL sync...');
  const response2 = await fetch('/api/conversations/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageId: 'your-page-id',
      facebookPageId: 'your-fb-page-id',
      forceFull: false  // Incremental
    })
  });
  
  const data2 = await response2.json();
  console.log('✅ INCREMENTAL SYNC RESULTS:', data2);
  
  console.log('✅ TEST 6 COMPARISON:');
  console.log('Full sync conversations:', data.synced);
  console.log('Incremental sync conversations:', data2.synced);
  console.log('Difference:', Math.abs(data.synced - data2.synced));
};

testFullSync();
```

**Expected:** Full sync gets more conversations than incremental

---

## TEST 7: Rate Limiting Check

### Check for Facebook rate limits:
```javascript
// Test 7: Check rate limit headers
fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?limit=5&access_token=${token}`)
  .then(response => {
    console.log('✅ TEST 7 RESULTS:');
    console.log('Status:', response.status);
    console.log('Rate limit headers:');
    console.log('x-business-use-case-usage:', response.headers.get('x-business-use-case-usage'));
    console.log('x-app-usage:', response.headers.get('x-app-usage'));
    console.log('x-ad-account-usage:', response.headers.get('x-ad-account-usage'));
    
    return response.json();
  })
  .then(data => {
    if (data.error?.code === 4 || data.error?.code === 17) {
      console.error('❌ RATE LIMITED!');
    }
  });
```

**Expected:** No rate limit errors
**Watch for:** Error codes 4 or 17

---

## TEST 8: Console Log Analysis

### Run sync and analyze logs:
```javascript
// Test 8: Capture all console logs
const originalLog = console.log;
const logs = [];

console.log = function(...args) {
  logs.push(args.join(' '));
  originalLog.apply(console, args);
};

fetch('/api/conversations/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pageId: 'your-page-id',
    facebookPageId: 'your-fb-page-id',
    forceFull: true
  })
})
.then(r => r.json())
.then(data => {
  console.log = originalLog;  // Restore
  
  console.log('✅ TEST 8 RESULTS - LOG ANALYSIS:');
  
  // Analyze logs
  const batchLogs = logs.filter(l => l.includes('Processing batch'));
  const errorLogs = logs.filter(l => l.includes('Error') || l.includes('error'));
  const timeoutLogs = logs.filter(l => l.includes('timeout') || l.includes('Approaching'));
  
  console.log('Total logs:', logs.length);
  console.log('Batch logs:', batchLogs.length);
  console.log('Error logs:', errorLogs.length);
  console.log('Timeout logs:', timeoutLogs.length);
  
  if (errorLogs.length > 0) {
    console.log('❌ ERRORS FOUND:', errorLogs);
  }
  
  if (timeoutLogs.length > 0) {
    console.log('⚠️ TIMEOUT WARNINGS:', timeoutLogs);
  }
});
```

---

## TEST 9: Conversation Count Comparison

### Compare Facebook count vs Database count:
```javascript
// Test 9A: Estimate Facebook total
let estimatedTotal = 0;

fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?summary=true&limit=1&access_token=${token}`)
  .then(r => r.json())
  .then(data => {
    // Facebook doesn't give exact totals, estimate from pagination
    console.log('Facebook API response:', data);
    console.log('Has paging:', !!data.paging?.next);
  });
```

```sql
-- Test 9B: Database count
SELECT 
  page_id,
  COUNT(*) as conversations_in_db,
  MIN(last_message_time) as oldest,
  MAX(last_message_time) as newest,
  MAX(created_at) as last_synced_conversation
FROM messenger_conversations
WHERE page_id = 'YOUR_FACEBOOK_PAGE_ID'
GROUP BY page_id;
```

**Compare:** Database count should match Facebook count

---

## TEST 10: Field Selection Check

### Check if field selection is causing issues:
```javascript
// Test 10: Compare different field sets
const fields1 = 'participants,updated_time';
const fields2 = 'participants,updated_time,messages{message,created_time,from}';

Promise.all([
  fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?fields=${fields1}&limit=5&access_token=${token}`).then(r => r.json()),
  fetch(`https://graph.facebook.com/v18.0/${pageId}/conversations?fields=${fields2}&limit=5&access_token=${token}`).then(r => r.json())
]).then(([data1, data2]) => {
  console.log('✅ TEST 10 RESULTS:');
  console.log('Simple fields count:', data1.data?.length);
  console.log('Complex fields count:', data2.data?.length);
  console.log('Should be equal:', data1.data?.length === data2.data?.length);
  
  if (data1.error || data2.error) {
    console.error('❌ Field error:', data1.error || data2.error);
  }
});
```

---

## DIAGNOSTIC CHECKLIST

Run all tests above and check:

- [ ] **TEST 1:** Facebook API returns data ✅ / ❌
- [ ] **TEST 2:** Pagination completes fully ✅ / ❌
- [ ] **TEST 3:** Participants are valid ✅ / ❌
- [ ] **TEST 4:** Database inserts succeed ✅ / ❌
- [ ] **TEST 5:** No timeouts ✅ / ❌
- [ ] **TEST 6:** Full sync gets all data ✅ / ❌
- [ ] **TEST 7:** No rate limiting ✅ / ❌
- [ ] **TEST 8:** No errors in logs ✅ / ❌
- [ ] **TEST 9:** Counts match ✅ / ❌
- [ ] **TEST 10:** Field selection works ✅ / ❌

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: Pagination Stops Early
**Symptom:** Gets 3,000-4,000 then stops
**Cause:** Timeout or rate limit
**Solution:** Already implemented - 300s timeout with graceful stop

### Issue 2: Participants Skipped
**Symptom:** Some conversations missing
**Cause:** Participant ID matches page ID
**Solution:** Check skip logic in code

### Issue 3: Database Constraint
**Symptom:** Some inserts fail silently
**Cause:** Unique constraint violations
**Solution:** Use upsert (already implemented)

### Issue 4: Incremental Sync
**Symptom:** Only gets recent conversations
**Cause:** last_synced_at causes incremental mode
**Solution:** Use forceFull: true (already implemented)

### Issue 5: Token Expiration
**Symptom:** API returns 401/403
**Cause:** Expired Facebook token
**Solution:** Refresh token

---

## NEXT STEPS

1. Run TEST 2 first (pagination chain)
2. Run TEST 9 (count comparison)
3. Run TEST 5 (timeout detection)
4. Check server logs during sync
5. Report findings

Share the test results and I'll provide specific fixes!

