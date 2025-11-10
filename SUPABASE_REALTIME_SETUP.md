# 🔴 Supabase Realtime Setup Guide

## Overview

This guide explains which tables need Realtime enabled in Supabase for the conversation sync feature to work optimally with live updates.

---

## 📊 Tables That Need Realtime Enabled

### 1. **`sync_state`** - REQUIRED for Real-time Sync Progress ✅

**Why**: Tracks ongoing sync operations and progress
**Usage**: Shows real-time sync progress in the UI
**Priority**: HIGH

#### How to Enable:

1. Go to Supabase Dashboard
2. Click **"Database"** → **"Replication"**
3. Find `sync_state` table
4. Click toggle to **Enable**
5. ✅ Done!

**What it does**:
- Tracks which page is being synced
- Shows current progress (X of Y conversations)
- Indicates if sync is complete
- Stores last cursor for resumption

---

### 2. **`messenger_conversations`** - RECOMMENDED for Live Conversation Updates ⭐

**Why**: Shows new conversations as they arrive
**Usage**: Auto-refreshes conversation list
**Priority**: MEDIUM

#### How to Enable:

1. Go to Supabase Dashboard
2. Click **"Database"** → **"Replication"**  
3. Find `messenger_conversations` table
4. Click toggle to **Enable**
5. ✅ Done!

**What it does**:
- New conversations appear instantly
- Updates show immediately
- No need to refresh page
- Real-time inbox experience

**Note**: This is already in your schema:
```sql
-- Enable realtime replication for messenger conversations
ALTER TABLE messenger_conversations REPLICA IDENTITY FULL;
```

---

### 3. **`sync_locks`** - OPTIONAL for Lock Monitoring 📊

**Why**: Monitor active sync locks
**Usage**: Admin/debug purposes
**Priority**: LOW

#### How to Enable:

1. Go to Supabase Dashboard
2. Click **"Database"** → **"Replication"**
3. Find `sync_locks` table
4. Click toggle to **Enable**
5. ✅ Done!

**What it does**:
- Shows which pages have active syncs
- Displays lock expiration times
- Helps debug stuck syncs

---

## 🚀 Step-by-Step: Enable Realtime

### Method 1: Via Supabase Dashboard (Recommended)

1. **Login** to your Supabase project
2. Go to **Database** → **Replication** (left sidebar)
3. You'll see a list of all tables
4. Find these tables and toggle them ON:
   - ✅ `sync_state`
   - ✅ `messenger_conversations`
   - ⭐ `sync_locks` (optional)

5. **Save** - Changes take effect immediately

### Method 2: Via SQL (Alternative)

```sql
-- Enable Realtime for sync_state
ALTER TABLE sync_state REPLICA IDENTITY FULL;

-- Enable Realtime for sync_locks  
ALTER TABLE sync_locks REPLICA IDENTITY FULL;

-- messenger_conversations is already enabled in your schema
-- But if you need to re-enable:
ALTER TABLE messenger_conversations REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
    -- Add sync_state
    ALTER PUBLICATION supabase_realtime ADD TABLE sync_state;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    -- Add sync_locks
    ALTER PUBLICATION supabase_realtime ADD TABLE sync_locks;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- messenger_conversations should already be added
```

---

## 📱 What Real-time Updates Look Like

### During Sync (with `sync_state` enabled):

```
Syncing... 
Batch 1
🔵 45 conversations    <- Updates in real-time!
15 new • 30 updated    <- Live counter
```

### In Conversation List (with `messenger_conversations` enabled):

```
[New conversation appears instantly]
👤 John Doe
💬 Hey, I'm interested...
🕐 Just now            <- No refresh needed!
```

---

## 🎯 Benefits of Enabling Realtime

### With `sync_state`:
- ✅ See exact count of conversations synced
- ✅ Know which batch is being processed
- ✅ Monitor sync progress live
- ✅ No guessing if sync is working

### With `messenger_conversations`:
- ✅ New messages appear instantly
- ✅ No manual page refresh
- ✅ Real-time inbox experience
- ✅ Better user experience

### With `sync_locks`:
- ✅ See which pages are syncing
- ✅ Debug stuck syncs easily
- ✅ Monitor lock status

---

## ⚡ Performance Impact

### Bandwidth Usage:
- **Minimal** - Only sends changed rows
- **Efficient** - Uses WebSocket (not polling)
- **Smart** - Only active when listening

### Database Load:
- **Low** - Native PostgreSQL feature
- **Optimized** - Built into Supabase
- **Scalable** - Handles many connections

### Pricing Impact:
- **Included** in Supabase plans
- **No extra cost** for reasonable usage
- **Free tier** supports realtime

---

## 🧪 Testing Realtime

### Test 1: Sync Progress

1. Enable `sync_state` realtime
2. Go to Conversations page
3. Select a page
4. Click "Sync"
5. **Watch**: Numbers update live as sync progresses

**Expected**:
```
Batch 1
🔵 0 conversations
   ↓
Batch 1
🔵 50 conversations    <- Increments live!
   ↓
Batch 2
🔵 150 conversations   <- Keeps updating!
```

### Test 2: Live Conversations

1. Enable `messenger_conversations` realtime
2. Go to Conversations page
3. Send yourself a Facebook message
4. **Watch**: New conversation appears without refresh

**Expected**:
- Conversation list updates automatically
- No "refresh" button needed
- Real-time like a chat app

---

## 🐛 Troubleshooting

### Issue: "Numbers don't update during sync"

**Check**:
1. Is `sync_state` enabled in Realtime?
2. Is WebSocket connection established?
3. Check browser console for errors

**Fix**:
```bash
# Browser console should show:
Connected to Realtime
Subscribed to sync_state
```

### Issue: "New conversations don't appear"

**Check**:
1. Is `messenger_conversations` enabled?
2. Is query invalidation working?
3. Check Realtime connection

**Fix**: Verify in Supabase Dashboard:
- Database → Replication
- `messenger_conversations` should be toggled ON

### Issue: "Realtime stopped working"

**Check**:
1. Supabase project status
2. Internet connection
3. WebSocket not blocked by firewall

**Fix**: Restart Realtime connection:
```typescript
// Usually handled automatically
// But you can force reconnect
supabase.realtime.disconnect()
supabase.realtime.connect()
```

---

## 📊 Realtime Architecture

### How It Works:

```
┌──────────────┐
│  User clicks │
│    "Sync"    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Sync starts     │
│  Updates DB      │
│  (sync_state)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐     ┌─────────────────┐
│  Supabase        │────▶│  WebSocket      │
│  Realtime        │     │  to Browser     │
└──────────────────┘     └─────────┬───────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  ManualSyncButton│
                         │  Updates UI      │
                         │  Live Counter!   │
                         └──────────────────┘
```

### Data Flow:

1. **Sync writes to `sync_state`**
2. **Supabase detects change**
3. **Broadcasts via WebSocket**
4. **Browser receives update**
5. **UI updates instantly**

---

## 🎛️ Advanced Configuration

### Filter Realtime by User

If you want to only receive updates for the current user:

```typescript
const channel = supabase
  .channel('sync_progress')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'sync_state',
      filter: `user_id=eq.${user.id}` // Only your syncs
    },
    (payload) => {
      console.log('Sync progress:', payload.new);
    }
  )
  .subscribe();
```

### Realtime Presence (Optional)

Show who else is syncing:

```typescript
const presence = supabase.channel('sync_presence')
presence.on('presence', { event: 'sync' }, () => {
  // Show "5 users syncing now"
})
```

---

## 📚 Documentation Links

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Replication](https://supabase.com/docs/guides/database/replication)
- [Realtime Filters](https://supabase.com/docs/guides/realtime/filters)

---

## ✅ Checklist

Before considering realtime setup complete:

- [ ] Enabled `sync_state` realtime in Supabase
- [ ] Enabled `messenger_conversations` realtime (optional but recommended)
- [ ] Tested sync with live counter visible
- [ ] Verified numbers update during sync
- [ ] Checked WebSocket connection in browser console
- [ ] Tested with multiple sync operations
- [ ] Confirmed no performance issues

---

## 🎉 Summary

### Required for Real-time Sync Progress:
✅ **`sync_state`** - Shows live count during sync

### Recommended for Best UX:
⭐ **`messenger_conversations`** - Live conversation updates

### Optional for Monitoring:
📊 **`sync_locks`** - Debug and monitor locks

---

## 🚀 Quick Enable (Copy-Paste Checklist)

1. **Go to**: Supabase Dashboard
2. **Click**: Database → Replication
3. **Enable**: 
   - [x] `sync_state` ✅
   - [x] `messenger_conversations` ⭐
   - [ ] `sync_locks` (optional)
4. **Test**: Click Sync button
5. **Watch**: Numbers update live! 🎉

---

**That's it!** Your real-time sync progress is now enabled! 🚀

---

*Last Updated: November 2024*
*Version: 1.0*
*Status: Production Ready*

