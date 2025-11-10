# 📥 Manual Sync Feature Documentation

## Overview

The Manual Sync feature allows users to manually fetch the latest conversations from Facebook on-demand, without relying on automatic syncing. This gives users complete control over when their conversation data is updated.

---

## ✨ Features

### 1. **On-Demand Syncing**
- Click a button to sync conversations anytime
- No need to wait for automatic syncs
- Full control over data refresh timing

### 2. **Visual Progress Tracking**
- Real-time progress indicator
- Status messages (Syncing, Success, Error)
- Sync statistics (new, updated conversations)

### 3. **Resumable Large Syncs**
- Automatically handles timeout for pages with many conversations
- Resume from where it left off
- No data loss on partial syncs

### 4. **Smart Locking**
- Prevents concurrent syncs on same page
- Shows "Sync already in progress" if attempted
- Automatically releases locks after completion or timeout

### 5. **Last Sync Tracking**
- Shows when page was last synced
- Stores sync history locally
- Displays helpful tooltips

---

## 🎯 User Experience

### Visual States

1. **Idle** (Default)
   - 🔄 Refresh icon
   - Text: "Sync"
   - Tooltip: "Last synced X ago" or "Manually sync conversations"

2. **Syncing**
   - ⏳ Spinning loader
   - Text: "Syncing..."
   - Progress bar showing activity
   - Button disabled

3. **Success**
   - ✅ Green checkmark
   - Text: "Synced!"
   - Shows sync statistics
   - Auto-resets to idle after 3 seconds

4. **Error**
   - ❌ Red alert icon
   - Text: "Failed"
   - Error message displayed
   - Auto-resets to idle after 5 seconds

5. **Partial Sync**
   - 🕐 Orange clock icon
   - Text: "Continue"
   - Shows option to resume
   - Click to continue syncing

---

## 🔧 Technical Implementation

### Component Architecture

```
ManualSyncButton
├── State Management
│   ├── syncStatus (idle, syncing, success, error, partial)
│   ├── lastSync (timestamp)
│   └── progress (0-100)
│
├── API Integration
│   ├── POST /api/conversations/sync-fixed
│   ├── Handles 409 (concurrent sync)
│   ├── Resume session support
│   └── Error recovery
│
├── UI Components
│   ├── Button with dynamic icon
│   ├── Tooltip with status
│   ├── Progress bar
│   └── Status messages
│
└── Callbacks
    └── onSyncComplete (refreshes data)
```

### Key Files

**Component**: `src/components/conversations/ManualSyncButton.tsx`
- Self-contained sync button
- Handles all sync logic
- Manages UI states

**Integration**: `src/app/dashboard/conversations/page.tsx`
- Imported ManualSyncButton
- Passes page info and callbacks
- Refreshes data after sync

**API Endpoint**: Uses `/api/conversations/sync-fixed`
- Fixed sync endpoint with all critical fixes
- Supports resumable syncs
- Returns detailed statistics

---

## 📊 How It Works

### Sync Flow

```
┌─────────────────┐
│  User clicks    │
│  "Sync" button  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check if sync  │◄── 409? Show "Already in progress"
│  already active │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Acquire lock   │
│  (DB-backed)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fetch from     │
│  Facebook API   │
└────────┬────────┘
         │
         ├── Timeout? ──────┐
         │                  │
         ▼                  ▼
┌─────────────────┐   ┌──────────────┐
│  Process data   │   │ Save state   │
│  atomically     │   │ Return       │
└────────┬────────┘   │ resumeSession│
         │            └──────────────┘
         ▼
┌─────────────────┐
│  Release lock   │
│  Show success   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Refresh UI     │
│  (queryClient)  │
└─────────────────┘
```

---

## 🎨 Usage Examples

### Basic Usage

```tsx
<ManualSyncButton
  pageId="page-uuid"
  facebookPageId="fb-page-id"
  pageName="My Page"
  onSyncComplete={() => {
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }}
/>
```

### With Custom Styling

```tsx
<ManualSyncButton
  pageId="page-uuid"
  facebookPageId="fb-page-id"
  variant="outline"     // or 'default', 'ghost'
  size="sm"             // or 'default', 'lg', 'icon'
  showProgress={true}   // Show progress bar during sync
/>
```

### Handling Resume

The component automatically handles resume:
- If sync times out, shows "Continue" button
- Click to resume from where it stopped
- Passes `resumeSession` automatically

---

## 💡 User Benefits

### 1. **No More Waiting**
- Don't wait for automatic syncs
- Get latest data immediately
- Sync after important Facebook activity

### 2. **Complete Control**
- Decide when to sync
- Sync only when needed
- Save API quota

### 3. **Transparency**
- See exactly what was synced
- Know when last sync happened
- Understand sync status

### 4. **Reliability**
- Handles large pages gracefully
- Resumes on timeout
- Never loses progress

### 5. **Safety**
- Can't double-sync same page
- Clear error messages
- Auto-recovery from errors

---

## 🔒 Security & Safety

### Distributed Locking
- Database-backed locks prevent concurrent syncs
- Auto-expires after 5 minutes
- Extends lock for long-running syncs

### Data Integrity
- Uses atomic transactions
- Events created with conversations
- No partial data

### Error Handling
- Graceful degradation on errors
- User-friendly error messages
- Automatic retry for transient errors

---

## 📈 Performance

### Optimizations

1. **Cursor-Based Pagination**
   - Resumes from exact position
   - No duplicate fetching
   - Handles 10,000+ conversations

2. **Progress Indication**
   - User knows sync is active
   - No confusion about status
   - Clear completion signal

3. **Local Storage**
   - Tracks last sync time
   - Persists across sessions
   - No DB queries for display

4. **Query Invalidation**
   - Automatically refreshes UI
   - Shows latest data immediately
   - No manual refresh needed

---

## 🧪 Testing

### Manual Test Scenarios

#### ✅ **Test 1: Basic Sync**
1. Go to Conversations page
2. Select a Facebook page
3. Click "Sync" button
4. Verify:
   - Button shows "Syncing..."
   - Progress bar appears
   - Button disabled during sync
   - Success message shows statistics
   - Conversations list refreshes

#### ✅ **Test 2: Concurrent Prevention**
1. Start a sync on Page A
2. While syncing, click Sync again
3. Verify:
   - Second click shows "Already in progress"
   - Toast notification appears
   - First sync continues unaffected

#### ✅ **Test 3: Resume Large Sync**
1. Sync a page with 5000+ conversations
2. Wait for timeout (~4.5 minutes)
3. Verify:
   - Shows "Continue" button
   - Displays partial progress
   - Click Continue resumes sync
   - No duplicate conversations

#### ✅ **Test 4: Error Handling**
1. Disconnect internet
2. Click Sync
3. Verify:
   - Shows error message
   - Button shows "Failed"
   - Auto-resets after 5 seconds
   - Can retry after reset

#### ✅ **Test 5: Last Sync Display**
1. Sync a page
2. Hover over Sync button
3. Verify:
   - Tooltip shows "Last synced X ago"
   - Time updates on page reload
   - Shows sync statistics

---

## 🐛 Troubleshooting

### Issue: "Sync already in progress"
**Cause**: Another sync is running for this page
**Solution**: Wait for current sync to complete, or check Supabase for stuck locks

**Manual Fix**:
```sql
-- Check active locks
SELECT * FROM sync_locks;

-- Clear stuck lock (if needed)
DELETE FROM sync_locks WHERE page_id = 'your-page-id';
```

### Issue: Button shows "Syncing..." forever
**Cause**: Frontend lost connection or browser closed during sync
**Solution**: 
1. Refresh page
2. Lock will auto-expire after 5 minutes
3. Try syncing again

### Issue: No conversations appear after sync
**Cause**: API error or invalid Facebook token
**Solution**:
1. Check browser console for errors
2. Verify Facebook token is valid
3. Reconnect Facebook page if needed

### Issue: Duplicate conversations
**Cause**: Database unique constraint issue (rare)
**Solution**: Run diagnostic query
```sql
SELECT sender_id, page_id, COUNT(*) 
FROM messenger_conversations 
GROUP BY sender_id, page_id 
HAVING COUNT(*) > 1;
```

---

## 📝 Configuration

### Component Props

```typescript
interface ManualSyncButtonProps {
  pageId: string;              // Supabase page UUID
  facebookPageId: string;      // Facebook page ID
  pageName?: string;           // Display name (optional)
  onSyncComplete?: () => void; // Callback after success
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showProgress?: boolean;      // Show progress bar (default: true)
}
```

### localStorage Keys

- `last_sync_${pageId}` - Stores last sync timestamp
- Format: ISO 8601 string
- Used for "Last synced X ago" display

---

## 🚀 Future Enhancements

### Planned Features

1. **Sync Schedule**
   - Set auto-sync interval per page
   - "Sync every X hours" option
   - Notification when auto-sync completes

2. **Selective Sync**
   - Sync only specific date ranges
   - Sync only certain conversation types
   - Filter during sync

3. **Sync History**
   - View past sync operations
   - See what was synced when
   - Sync analytics dashboard

4. **Batch Sync**
   - Sync multiple pages at once
   - Queue management
   - Progress for each page

5. **Smart Sync**
   - Only sync if new messages exist
   - Check via lightweight API call
   - Save API quota

---

## 📚 Related Documentation

- **CONVERSATION_SYNC_FLAWS_ANALYSIS.md** - Why manual sync was needed
- **MIGRATION_GUIDE.md** - How to deploy sync fixes
- **CRITICAL_FIXES_MIGRATION.sql** - Database changes required

---

## ✅ Checklist for Deployment

- [x] Component created and tested
- [x] Integrated into conversations page
- [x] No linting errors
- [x] Uses fixed sync endpoint
- [x] Handles all edge cases
- [x] User-friendly error messages
- [x] Progress indication works
- [x] Resume functionality works
- [x] Lock mechanism prevents conflicts
- [x] Documentation complete

---

## 🎉 Summary

The Manual Sync feature provides users with:
- ✅ **Complete control** over data refresh timing
- ✅ **Visual feedback** during sync operations
- ✅ **Reliability** for large pages
- ✅ **Safety** against conflicts
- ✅ **Transparency** about sync status

**Ready for production!** 🚀

---

*Last Updated: November 2024*
*Version: 1.0*
*Status: Production Ready*

