# 🔄 Complete Message Flow: Webhook vs Sending

## 📊 Visual Comparison

```
╔═══════════════════════════════════════════════════════════════════╗
║                    WEBHOOK (RECEIVING MESSAGES)                    ║
║                          Automatic & Real-time                     ║
╚═══════════════════════════════════════════════════════════════════╝

    User (Customer)
         │
         │ 1. Sends message via 
         │    Facebook Messenger
         ↓
    Facebook Server
         │
         │ 2. Forwards to your webhook
         │    POST /api/webhook
         ↓
    Your Next.js App
    (/api/webhook/route.ts)
         │
         │ 3. Extracts data:
         │    - sender_id
         │    - message_text
         │    - timestamp
         ↓
    Supabase Database
    (messenger_conversations)
         │
         │ 4. Saved for you to see
         ↓
    Dashboard UI
    (/dashboard/conversations)
         │
         └─→ You can now reply!


╔═══════════════════════════════════════════════════════════════════╗
║                    SEND API (SENDING MESSAGES)                     ║
║                         Manual (You initiate)                      ║
╚═══════════════════════════════════════════════════════════════════╝

    You (Business Owner)
         │
         │ 1. Click "Send Message"
         │    in your app
         ↓
    Dashboard UI
    (/dashboard/compose)
         │
         │ 2. Submit form data
         │    POST /api/messages
         ↓
    Next.js API
    (Creates message in DB)
         │
         │ 3. Trigger send
         │    POST /api/messages/[id]/send
         ↓
    Facebook Send API
    (graph.facebook.com/me/messages)
         │
         │ 4. Facebook delivers
         ↓
    User (Customer)
         │
         └─→ Receives in Messenger
```

---

## 🔄 Two-Way Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE CONVERSATION                         │
└─────────────────────────────────────────────────────────────────┘

Day 1, 10:00 AM
User: "Hello, do you have product X?"
   │
   ├─→ Webhook receives → Saves to DB → Shows in your dashboard
   │
   └─→ You have 24 hours to reply freely


Day 1, 10:30 AM (Within 24h window)
You: "Yes! We have it in stock"
   │
   ├─→ You click Send → API calls Facebook → Message delivered
   │
   └─→ User receives your reply


Day 1, 11:00 AM
User: "Great! How much is it?"
   │
   ├─→ Webhook receives → Updates conversation → You see it
   │
   └─→ 24h window resets from this message


Day 1, 11:15 AM
You: "It's $99. Would you like to order?"
   │
   └─→ Sent via Send API → User receives


Day 2, 12:00 PM (More than 24h since last user message)
You: "Still interested?"
   │
   └─→ ❌ BLOCKED! Outside 24h window
       (Unless you use Message Tags for specific use cases)
```

---

## 📋 Key Differences

| Aspect | Webhook (Receive) | Send API (Send) |
|--------|-------------------|-----------------|
| **Direction** | User → You | You → User |
| **Trigger** | User sends message | You click Send |
| **Automatic?** | ✅ Yes, real-time | ❌ No, manual |
| **Stores in DB?** | ✅ Yes, via webhook | ✅ Yes, before sending |
| **Needs Token?** | ❌ No (Facebook calls you) | ✅ Yes (page access token) |
| **24h Policy?** | ❌ N/A | ✅ Yes, must be within 24h |
| **Rate Limit?** | None (receives) | Yes (sending) |
| **Facebook URL** | They call YOUR URL | You call THEIR URL |
| **HTTP Method** | POST (from Facebook) | POST (to Facebook) |

---

## 🎯 Use Cases Combined

### **Scenario 1: New Customer Inquiry**

```
1. User: "I'm interested in your service"
   → Webhook: Saved to messenger_conversations
   → Dashboard: Shows as new lead
   → You: See notification, can reply

2. You: "Great! Let me tell you more..."
   → Send API: Delivers message
   → User: Receives in Messenger

3. User: "Sounds good!"
   → Webhook: Updates conversation
   → Dashboard: Shows conversation history
```

### **Scenario 2: Bulk Campaign**

```
1. You: Prepare bulk message in compose page
   → Select 100 recipients from conversations
   → Click "Send to 100 Selected"

2. Send API: Loops through recipients
   → Sends to recipient 1, 2, 3... 100
   → Tracks: 95 sent, 5 failed (outside 24h)

3. Users: Receive your campaign message
   → Some reply → Webhook captures replies
   → Shows in your conversations dashboard
```

### **Scenario 3: Follow-up Sequence**

```
Day 1:
User: "How much is it?"
   → Webhook: Saves initial inquiry

You: "It's $99"
   → Send API: Immediate response
   
Day 2:
You: "Still interested?"
   → Send API: ✅ Sent (within 24h of last reply)

Day 3:
User hasn't replied for 48h
You: "Last chance discount!"
   → Send API: ❌ Blocked (outside 24h)
   
Solution: Wait for user to message first, OR use Message Tags
```

---

## 🔧 Technical Implementation

### **Webhook Endpoint (`/api/webhook/route.ts`)**

```typescript
// Receives from Facebook
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Facebook sends this structure:
  // {
  //   object: "page",
  //   entry: [{
  //     messaging: [{
  //       sender: { id: "user_psid" },
  //       message: { text: "Hello!" }
  //     }]
  //   }]
  // }
  
  // Save to database
  await supabase.from('messenger_conversations').upsert({
    sender_id: event.sender.id,
    last_message: event.message.text,
    last_message_time: new Date().toISOString()
  });
  
  // MUST return 200 OK
  return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
}
```

### **Send API (`/api/messages/[id]/send/route.ts`)**

```typescript
// Sends to Facebook
export async function POST(request: NextRequest) {
  // Get recipients from database
  const recipients = ['psid1', 'psid2', ...];
  
  // Send to each
  for (const recipientId of recipients) {
    // Call Facebook Send API
    await fetch('https://graph.facebook.com/v18.0/me/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
        access_token: pageAccessToken
      })
    });
  }
  
  return NextResponse.json({ sent: 50, failed: 5 });
}
```

---

## 🚦 Complete System Flow

```
┌────────────────────────────────────────────────────────────┐
│                    USER MESSAGES YOU                        │
└────────────────────────────────────────────────────────────┘
                           ↓
              [Facebook forwards to webhook]
                           ↓
              POST /api/webhook (Your server)
                           ↓
          Parse: sender_id, message_text, timestamp
                           ↓
      Save to messenger_conversations (Supabase)
                           ↓
          Appears in /dashboard/conversations
                           ↓
              [You see the message]
                           ↓
         You click recipient → "Send Message"
                           ↓
              Fill form in /dashboard/compose
                           ↓
              POST /api/messages (Create draft)
                           ↓
         POST /api/messages/[id]/send (Trigger send)
                           ↓
    Loop through recipients → Call Facebook Send API
                           ↓
     POST graph.facebook.com/me/messages (Each recipient)
                           ↓
              [Facebook delivers to user]
                           ↓
┌────────────────────────────────────────────────────────────┐
│                   USER RECEIVES MESSAGE                     │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### **Webhook Saves:**

```javascript
// What goes into messenger_conversations:
{
  user_id: "your_user_id",        // Who owns the page
  page_id: "505302195998738",     // Your page
  sender_id: "24934311549542539", // Customer
  sender_name: "John Doe",        // Customer name
  last_message: "Hello!",         // What they said
  last_message_time: "2024-10-22T10:00:00Z",
  conversation_status: "active",
  message_count: 1
}
```

### **Send API Creates:**

```javascript
// What goes into messages table:
{
  id: "msg-uuid",
  title: "Weekly Promotion",
  content: "Check out our sale!",
  page_id: "page-uuid",
  recipient_type: "selected",
  selected_recipients: ["24934311549542539", ...],
  status: "sent",
  delivered_count: 95,
  failed_count: 5
}
```

---

## ✅ Summary

| Feature | Status | File |
|---------|--------|------|
| **Webhook Verification** | ✅ Implemented | `/api/webhook/route.ts` |
| **Receive Messages** | ✅ Implemented | `/api/webhook/route.ts` |
| **Save to Database** | ✅ Implemented | `messenger_conversations` |
| **Display Conversations** | ✅ Implemented | `/dashboard/conversations` |
| **Send Messages** | ✅ Implemented | `/api/messages/[id]/send` |
| **Bulk Send** | ✅ Implemented | `/dashboard/compose` |
| **Track Results** | ✅ Implemented | `messages` table |

**Complete two-way communication system ready!** 🎉

---

## 🚀 Next Steps

1. **Webhook Setup:**
   - Add `WEBHOOK_VERIFY_TOKEN=Token123` to `.env.local`
   - Deploy to Vercel or use ngrok
   - Configure in Facebook App Settings

2. **Test Receiving:**
   - Send message to your page
   - Check if appears in conversations

3. **Test Sending:**
   - Refresh your Facebook tokens (logout/login)
   - Select contacts → Send message
   - Verify delivery

4. **Monitor:**
   - Check Supabase for stored conversations
   - Check messages table for sent campaigns
   - Review success/failure rates

**Both webhook and sending are ready to use!** 🚀

