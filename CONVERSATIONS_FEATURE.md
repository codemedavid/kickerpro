# 💬 Conversations & Leads Feature - Complete Guide

## 🎉 New Feature Added!

I just built a complete **Conversations & Leads** page where you can:
- ✅ View all people who messaged your Facebook pages
- ✅ Filter by date range
- ✅ Filter by specific Facebook page
- ✅ Search by name, ID, or message content
- ✅ See who you can message (24-hour window)
- ✅ Sync new conversations from Facebook
- ✅ Beautiful, responsive interface

---

## 🚀 How to Access

### Navigate to Conversations Page:

**Option 1:** Click **"Conversations"** in the sidebar (new link added!)

**Option 2:** Visit directly:
```
http://localhost:3000/dashboard/conversations
```

---

## 📊 What You'll See

### 1. **Statistics Cards**

- **Total Conversations** - All people who messaged you
- **Active Conversations** - Currently active chats
- **Within 24 Hours** - People you can message right now (Facebook's 24-hour policy)

### 2. **Filter Section**

Four powerful filters:

- **📱 Facebook Page** - Filter by specific page or see all
- **📅 Start Date** - Show conversations from this date onwards
- **📅 End Date** - Show conversations up to this date
- **🔍 Search** - Search by name, sender ID, or message content

### 3. **Conversations List**

Each conversation shows:
- **Profile Picture** - User avatar (placeholder)
- **Name** - Sender's name
- **Status Badge** - Active/Inactive/Blocked
- **Can Message Badge** - If within 24-hour window (orange badge)
- **Last Message** - Preview of their message
- **Page Name** - Which page they messaged
- **Timestamp** - When they last messaged
- **Message Count** - Total messages in conversation
- **Sender ID** - Facebook user ID

---

## 🎯 How to Use

### Step 1: Sync Conversations from Facebook

1. **Select a Facebook page** from the page filter dropdown
2. **Click "Sync from Facebook"** button
3. Wait for sync to complete
4. ✅ Conversations appear in the list!

**Console logs you'll see:**
```javascript
✅ [Sync Conversations] Syncing for page: 123456789
✅ [Sync Conversations] Calling Facebook API...
✅ [Sync Conversations] Found 15 conversations from Facebook
✅ [Sync Conversations] Synced 15 conversations successfully
✅ Synced 15 conversation(s) from Facebook
```

### Step 2: Filter by Date

Want to see conversations from last week?

1. **Set Start Date:** e.g., October 15, 2025
2. **Set End Date:** e.g., October 22, 2025
3. List updates automatically
4. See conversations only from that date range

### Step 3: Search for Specific People

1. **Type in search box:** Name, Facebook ID, or message text
2. Results filter in real-time
3. Find specific conversations quickly

### Step 4: Clear Filters

Click **"Clear Filters"** button to reset all filters and see everything.

---

## 🔍 Understanding the 24-Hour Policy

### What is it?

Facebook's Messenger Platform Policy states:
> You can only send promotional messages to users who contacted your page within the last 24 hours.

### How it works in the app:

**"Can Message" Badge (Orange):**
- Shows on conversations where last message was < 24 hours ago
- These people can receive your bulk messages
- After 24 hours, the badge disappears

**Example:**
- User messaged at: 2:00 PM today
- Current time: 3:00 PM today (1 hour later)
- ✅ Can Message badge shows
- You can send them bulk messages

- Current time: 3:00 PM tomorrow (25 hours later)
- ❌ No badge
- Cannot send promotional messages (unless they message again)

---

## 🔄 Syncing Conversations

### When to Sync:

- **First time** - Load initial conversations
- **Daily** - Get new conversations
- **Before sending** - Make sure list is up to date

### What Gets Synced:

From Facebook Graph API `/conversations` endpoint:
- Sender ID
- Sender name
- Last message time
- Conversation participants

### Sync Process:

```
1. Click "Sync from Facebook"
   ↓
2. App calls Facebook Graph API
   GET /{pageId}/conversations
   ↓
3. Facebook returns conversation data
   ↓
4. App saves to messenger_conversations table
   ↓
5. Duplicates are updated (upsert)
   ↓
6. Success! List refreshes
```

---

## 📁 API Endpoints

### GET `/api/conversations`

Fetch conversations with optional filters.

**Query Parameters:**
- `pageId` - Filter by page (optional)
- `startDate` - Filter from date (optional)
- `endDate` - Filter to date (optional)
- `status` - Filter by status (default: 'active')

**Example:**
```
GET /api/conversations?pageId=abc123&startDate=2025-10-15&endDate=2025-10-22
```

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "sender_id": "123456789",
      "sender_name": "John Doe",
      "last_message": "Hello, I have a question",
      "last_message_time": "2025-10-22T10:30:00Z",
      "conversation_status": "active",
      "message_count": 3,
      "page_id": "987654321"
    }
  ],
  "count": 1
}
```

### POST `/api/conversations/sync`

Sync conversations from Facebook.

**Body:**
```json
{
  "pageId": "internal-uuid",
  "facebookPageId": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "synced": 15,
  "total": 15
}
```

---

## 💡 Use Cases

### 1. Find Recent Leads

**Scenario:** You want to message people who contacted you today.

**Solution:**
- Set Start Date: Today's date
- Look for "Can Message" badges
- These are your hot leads!

### 2. Follow Up on Old Conversations

**Scenario:** Someone messaged last week but you didn't respond.

**Solution:**
- Set date range to last week
- Search for their name
- See their conversation
- Note: Can't send promotional messages after 24 hours

### 3. Analyze Messaging Patterns

**Scenario:** See when people message you most.

**Solution:**
- Use date filters to check different time periods
- Look at timestamps
- Plan your response times

### 4. Export Leads for Other Tools

**Scenario:** You want to use conversation data elsewhere.

**Solution:**
- All data is in Supabase `messenger_conversations` table
- Can export via Supabase dashboard
- Or build custom export feature

---

## 🎨 UI Features

### Filter Panel:
- **Clean Design** - Easy to understand
- **Real-time Updates** - Results update as you type
- **Clear Button** - Reset all filters instantly
- **Responsive** - Works on mobile and desktop

### Conversation Cards:
- **Avatar** - Visual identification
- **Status Badges** - Quick status view
- **24-Hour Indicator** - See who you can message
- **Message Preview** - See last message
- **Page Context** - Know which page they messaged
- **Timestamps** - See when they last contacted you
- **Message Count** - Track conversation activity

### Empty States:
- **No Conversations** - Clear call-to-action
- **No Results** - Helpful message to adjust filters
- **Sync Button** - Easy way to load data

---

## 🔧 Advanced Filtering Examples

### Example 1: Today's Leads
```
Start Date: 2025-10-22
End Date: 2025-10-22
Result: All conversations from today
```

### Example 2: Last 7 Days
```
Start Date: 2025-10-15
End Date: 2025-10-22
Result: Week's worth of conversations
```

### Example 3: Specific Page This Month
```
Page: "Web Negosyo"
Start Date: 2025-10-01
End Date: 2025-10-22
Result: All conversations for that page this month
```

### Example 4: Search for Someone
```
Search: "john"
Result: All conversations with "john" in name or message
```

### Example 5: Combine Filters
```
Page: "Nota & Hiwaga PH"
Start Date: 2025-10-20
Search: "question"
Result: Recent conversations on that page mentioning "question"
```

---

## 🗄️ Database Schema

Conversations are stored in `messenger_conversations` table:

```sql
CREATE TABLE messenger_conversations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    page_id TEXT NOT NULL,              -- Facebook page ID
    sender_id TEXT NOT NULL,            -- Facebook user ID
    sender_name TEXT,                   -- User's name
    last_message TEXT,                  -- Last message content
    last_message_time TIMESTAMPTZ,      -- When they messaged
    conversation_status TEXT,           -- active/inactive/blocked
    message_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, page_id, sender_id)
);
```

---

## 🚀 Next Steps

Now that you can see your conversations, you can:

### 1. **Send Bulk Messages**
- Go to Compose Message
- Select a page
- Write your message
- Send to people within 24-hour window

### 2. **Analyze Your Leads**
- Use filters to segment your audience
- Find high-value conversations
- Track response patterns

### 3. **Build Follow-Up Campaigns**
- Schedule messages for specific date ranges
- Target people who messaged about specific topics
- Re-engage inactive conversations

---

## 📝 Files Created

1. ✅ `/app/api/conversations/route.ts` - Fetch conversations with filters
2. ✅ `/app/api/conversations/sync/route.ts` - Sync from Facebook
3. ✅ `/app/dashboard/conversations/page.tsx` - Beautiful UI
4. ✅ Updated sidebar with Conversations link

---

## ✅ Testing Checklist

- [ ] Visit `/dashboard/conversations`
- [ ] Select a Facebook page from filter
- [ ] Click "Sync from Facebook"
- [ ] See conversations appear
- [ ] Try date filtering
- [ ] Try search functionality
- [ ] Check "Can Message" badges
- [ ] Clear filters and see all results

---

## 🎊 Summary

You now have a complete **Conversations & Leads Management System**!

**Features:**
- ✅ View all messenger conversations
- ✅ Filter by date range
- ✅ Filter by Facebook page
- ✅ Search by name/ID/message
- ✅ See 24-hour messaging window
- ✅ Sync from Facebook
- ✅ Beautiful, intuitive UI

**Perfect for:**
- Lead management
- Customer support tracking
- Planning messaging campaigns
- Understanding your audience

**Try it now:** `/dashboard/conversations` 🚀

