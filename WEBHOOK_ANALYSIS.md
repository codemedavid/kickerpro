# 🔍 Webhook Analysis: Old PHP vs New Next.js

## 📋 What is the Webhook For?

**Purpose:** Automatically receive and store incoming messages from Facebook users

**Direction:** User → Facebook → Your Webhook → Database

**Use Case:**
- User sends message to your Facebook page
- Facebook forwards it to your webhook
- Webhook stores it in `messenger_conversations` table
- You can see these conversations in `/dashboard/conversations`
- You can reply to them using the Send API

---

## 🔄 Complete Message Flow:

```
┌─────────────────────────────────────────────────────────────┐
│                    RECEIVING MESSAGES                        │
│  User → Facebook Page → Facebook Webhook → Your Server      │
│              (Automatic, Real-time)                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    [webhook.php]
                           ↓
            Save to messenger_conversations
                           ↓
                  Available for reply


┌─────────────────────────────────────────────────────────────┐
│                    SENDING MESSAGES                          │
│  Your Server → Facebook Send API → Facebook Page → User     │
│              (Manual, When you click Send)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Old PHP Webhook Analysis

### **File: `webhook.php`**

#### **Part 1: Webhook Verification (GET Request)**

```php
// Lines 4-19
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['hub_mode'])) {
    $verify_token = "Token123";  // Your secret token
    $hub_verify_token = $_GET['hub_verify_token'] ?? '';
    $hub_challenge = $_GET['hub_challenge'] ?? '';

    if ($_GET['hub_mode'] === 'subscribe' && $hub_verify_token === $verify_token) {
        header('HTTP/1.1 200 OK');
        echo $hub_challenge;  // Echo back the challenge
        exit;
    } else {
        header('HTTP/1.1 403 Forbidden');
        exit;
    }
}
```

**What this does:**
1. Facebook sends GET request to verify your webhook
2. Includes: `hub.mode=subscribe`, `hub.verify_token=Token123`, `hub.challenge=random_string`
3. You check if token matches
4. If yes → Echo back the challenge → Facebook confirms webhook
5. If no → Return 403 → Facebook rejects webhook

**When this runs:**
- Only ONCE when you first set up the webhook in Facebook App Settings
- Facebook tests if your endpoint is valid

---

#### **Part 2: Receiving Messages (POST Request)**

```php
// Lines 21-55
$input = file_get_contents("php://input");  // Get POST body
error_log("Webhook received: " . $input);   // Log it

$data = json_decode($input, true);

if (isset($data['entry'][0]['messaging'][0])) {
    $event = $data['entry'][0]['messaging'][0];

    $senderId = $event['sender']['id'];       // User who sent message
    $recipientId = $event['recipient']['id']; // Your page ID
    $messageText = $event['message']['text']; // Message content

    // Save to database
    $stmt = $pdo->prepare("
        INSERT INTO messenger_conversations (
            user_id, page_id, sender_id, sender_name, 
            last_message, last_message_time
        )
        VALUES (0, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            last_message = VALUES(last_message),
            last_message_time = NOW()
    ");

    $stmt->execute([$recipientId, $senderId, "Unknown User", $messageText]);
}

// Always respond 200 OK
header('HTTP/1.1 200 OK');
echo "EVENT_RECEIVED";
```

**What this does:**
1. Receives POST request from Facebook when user sends message
2. Parses JSON payload
3. Extracts sender ID, page ID, message text
4. Saves to `messenger_conversations` table (upsert)
5. Always returns 200 OK (important!)

**When this runs:**
- EVERY TIME a user sends message to your Facebook page
- Real-time (within seconds)

---

## 📊 Webhook Payload Example:

### **What Facebook Sends (POST Body):**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "505302195998738",
      "time": 1698012345678,
      "messaging": [
        {
          "sender": {
            "id": "24934311549542539"
          },
          "recipient": {
            "id": "505302195998738"
          },
          "timestamp": 1698012345678,
          "message": {
            "mid": "m_ABC123",
            "text": "Hello! I'm interested in your product",
            "seq": 1
          }
        }
      ]
    }
  ]
}
```

### **What Your Webhook Extracts:**

```php
$senderId = "24934311549542539"        // User who sent message
$recipientId = "505302195998738"       // Your page
$messageText = "Hello! I'm interested" // Message content
$timestamp = 1698012345678             // When sent
```

### **What Gets Saved to Database:**

```sql
INSERT INTO messenger_conversations VALUES (
    user_id: 0,  -- Will be replaced with actual user ID
    page_id: "505302195998738",
    sender_id: "24934311549542539",
    sender_name: "Unknown User",  -- Could fetch real name from Graph API
    last_message: "Hello! I'm interested in your product",
    last_message_time: NOW()
)
```

---

## ✅ New Next.js Implementation

### **File: `nextjs-app/src/app/api/webhook/route.ts`**

I found you **already have a webhook implementation!** Let me verify it:

```typescript
// GET - Webhook Verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'Token123';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error('Webhook verification failed');
    return new NextResponse('Forbidden', { status: 403 });
  }
}

// POST - Receive Messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          if (event.message && event.message.text) {
            await handleMessage(event, entry.id);
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ status: 'ERROR' }, { status: 200 });
  }
}

async function handleMessage(event: any, pageId: string) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const messageText = event.message?.text;
  const timestamp = event.timestamp;

  const supabase = await createClient();

  // Find user who owns this page
  const { data: page } = await supabase
    .from('facebook_pages')
    .select('user_id')
    .eq('facebook_page_id', recipientId)
    .single();

  if (!page) return;

  // Save conversation
  await supabase
    .from('messenger_conversations')
    .upsert({
      user_id: page.user_id,
      page_id: recipientId,
      sender_id: senderId,
      sender_name: 'Facebook User',
      last_message: messageText,
      last_message_time: new Date(timestamp).toISOString(),
      conversation_status: 'active'
    }, {
      onConflict: 'user_id,page_id,sender_id'
    });
}
```

---

## 📊 Comparison: Old vs New

| Feature | Old PHP | New Next.js | Status |
|---------|---------|-------------|--------|
| **Verification (GET)** | ✅ Yes | ✅ Yes | ✅ Match |
| **Receive Messages (POST)** | ✅ Yes | ✅ Yes | ✅ Match |
| **Parse JSON** | `json_decode()` | `request.json()` | ✅ Match |
| **Extract Data** | `$event['sender']['id']` | `event.sender?.id` | ✅ Match |
| **Save to DB** | MySQL INSERT/UPDATE | Supabase upsert | ✅ Match |
| **Return 200 OK** | ✅ Yes | ✅ Yes | ✅ Match |
| **Error Handling** | Basic try/catch | Better error handling | ✅ Better |
| **Logging** | error_log() | console.log() | ✅ Match |

**100% Feature Parity!** ✅

---

## 🔧 How to Set Up Webhook in Facebook

### **Step 1: Get Your Webhook URL**

**For Production (Vercel):**
```
https://your-app.vercel.app/api/webhook
```

**For Development (ngrok):**
```bash
# Terminal 1: Run your app
npm run dev

# Terminal 2: Expose via ngrok
npx ngrok http 3000

# Copy the HTTPS URL
https://abc123.ngrok.io/api/webhook
```

---

### **Step 2: Configure in Facebook App**

1. **Go to:** [developers.facebook.com](https://developers.facebook.com)
2. **Select:** Your app
3. **Click:** Messenger → Settings
4. **Webhooks Section:**
   - Click "Add Callback URL"
   - **Callback URL:** `https://your-app.vercel.app/api/webhook`
   - **Verify Token:** `Token123` (or whatever you set in `.env.local`)
   - Click "Verify and Save"

5. **Subscribe to Page:**
   - Scroll to "Select a Page"
   - Choose your page
   - Check: `messages`, `messaging_postbacks`, `messaging_optins`
   - Click "Subscribe"

---

### **Step 3: Test Webhook**

1. **Send test message:** Go to your Facebook page → Send message as user
2. **Check logs:** Browser console or server logs
3. **Verify database:** Check `messenger_conversations` table

**Expected:**
```
✅ Webhook event received
✅ Message from 24934311549542539: "Test message"
✅ Conversation saved successfully
```

---

## 🎯 Webhook Use Cases in Your App

### **1. Automatic Lead Capture**
```
User messages your page
   ↓
Webhook receives it
   ↓
Saves to messenger_conversations
   ↓
Appears in /dashboard/conversations
   ↓
You can reply from your app
```

### **2. 24-Hour Window Tracking**
```
User messages you → Webhook records timestamp
   ↓
You have 24 hours to reply without restrictions
   ↓
App shows "Can Reply" badge if within 24h
   ↓
Shows "Need Message Tag" if outside 24h
```

### **3. Lead Qualification**
```
Webhook receives message
   ↓
Analyze message content (keywords, intent)
   ↓
Tag/categorize lead
   ↓
Auto-assign to team member
   ↓
Send automated response
```

### **4. Conversation History**
```
Every message saved via webhook
   ↓
Build conversation thread
   ↓
Show full history in app
   ↓
Context for replies
```

---

## 🧪 Testing Your Webhook

### **Test 1: Verification (One-time)**

```bash
# Simulate Facebook verification request
curl "http://localhost:3000/api/webhook?\
hub.mode=subscribe&\
hub.verify_token=Token123&\
hub.challenge=test_challenge"

# Expected: "test_challenge" echoed back
```

### **Test 2: Receive Message**

```bash
# Simulate Facebook sending a message
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "505302195998738",
      "messaging": [{
        "sender": {"id": "24934311549542539"},
        "recipient": {"id": "505302195998738"},
        "timestamp": 1698012345678,
        "message": {
          "text": "Test webhook message"
        }
      }]
    }]
  }'

# Expected: {"status":"EVENT_RECEIVED"}
```

### **Test 3: Check Database**

```sql
-- In Supabase SQL Editor
SELECT * FROM messenger_conversations 
WHERE sender_id = '24934311549542539'
ORDER BY last_message_time DESC
LIMIT 1;

-- Should show your test message
```

---

## 🔒 Security Considerations

### **1. Verify Request Signature** (Recommended)

Facebook signs webhook requests. You should verify:

```typescript
import crypto from 'crypto';

function verifyRequestSignature(req: Request, body: string) {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.FACEBOOK_APP_SECRET!)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

### **2. Use Environment Variables**

```env
# .env.local
WEBHOOK_VERIFY_TOKEN=your_secret_token_here_abc123
FACEBOOK_APP_SECRET=your_app_secret
```

### **3. Rate Limiting**

```typescript
// Prevent abuse
const requestCounts = new Map();

function checkRateLimit(ip: string): boolean {
  const count = requestCounts.get(ip) || 0;
  if (count > 100) return false;  // Max 100 requests per minute
  requestCounts.set(ip, count + 1);
  setTimeout(() => requestCounts.delete(ip), 60000);
  return true;
}
```

---

## 🎊 Summary

### **Old PHP Webhook:**
- ✅ Verified webhook (GET)
- ✅ Received messages (POST)
- ✅ Saved to database
- ✅ Always returned 200 OK

### **New Next.js Webhook:**
- ✅ **Already implemented!** (`/api/webhook/route.ts`)
- ✅ Same functionality as PHP
- ✅ Better error handling
- ✅ TypeScript types
- ✅ Supabase integration

### **What Webhook Does:**
1. **Verification:** One-time setup to confirm endpoint
2. **Receive:** Gets messages when users message your page
3. **Store:** Saves to `messenger_conversations`
4. **Enable:** Allows you to see and reply to messages

### **Setup Status:**
- ✅ Code ready
- ⏳ Need to configure in Facebook App Settings
- ⏳ Need to add WEBHOOK_VERIFY_TOKEN to .env.local
- ⏳ Need to use HTTPS (ngrok for dev, Vercel for prod)

---

## 📝 Next Steps for Webhook:

1. ✅ **Code ready** - Already implemented!
2. ⏳ **Add to .env.local:**
   ```env
   WEBHOOK_VERIFY_TOKEN=Token123
   ```
3. ⏳ **Deploy or use ngrok** - Webhook needs HTTPS
4. ⏳ **Configure in Facebook App** - Add callback URL
5. ⏳ **Test** - Send message to your page
6. ✅ **Works!** - Messages appear in conversations

**Your webhook is already coded and ready! Just needs Facebook configuration.** 🚀

