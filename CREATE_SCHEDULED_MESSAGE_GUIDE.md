# How to Create and Test Scheduled Messages

## ✅ Fix Applied

The scheduled message sending system has been fixed. The cron job now uses the Supabase service role key to bypass RLS policies, allowing it to access and send scheduled messages for all users.

## 🔧 Required Setup

### 1. Environment Variable in Vercel

Make sure this is set in Vercel:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get your service role key from:
- Supabase Dashboard → Settings → API → `service_role` key (secret)

⚠️ **After adding the environment variable, you MUST redeploy!**

## 📝 How to Create a Scheduled Message

1. **Go to your app's dashboard**

2. **Create a new message:**
   - Click "New Message" or "Compose"
   - Enter your message title and content
   - Select a Facebook page
   - Choose recipients

3. **Schedule it:**
   - Set the status to "Scheduled" (not "Draft")
   - Set `scheduled_for` to a future date/time
   - Example: If it's 12:00 PM now, schedule for 12:05 PM (5 minutes from now)

4. **Save the message**

## 🧪 Testing the Scheduled Send

### Option 1: Wait for Cron (Automatic)

The cron job runs every 1 minute. Just wait and check the logs:

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click "Functions" tab
3. Click `/api/cron/send-scheduled`
4. Watch the logs

You should see:
```
[Cron Send Scheduled] Found X message(s) due for sending
[Cron Send Scheduled] ✅ Successfully sent message: [Your Title]
```

### Option 2: Test with Diagnostic Script

Run this locally to check your scheduled messages:

```bash
node test-scheduled-messages.js
```

This will show:
- All scheduled messages in the database
- Which ones are due for sending
- When they will be sent

### Option 3: Check All Messages

To see all messages (any status):

```bash
node check-all-messages.js
```

## 🔍 What the Cron Job Does

Every 1 minute, the cron job:

1. Queries for messages where:
   - `status = 'scheduled'`
   - `scheduled_for <= current_time`

2. For each due message:
   - Updates status to 'sending'
   - Fetches the Facebook page access token
   - Gets the recipients list
   - Sends the message to all recipients
   - Updates status to 'sent' when complete

3. Logs the results

## 🐛 Troubleshooting

### "No messages due for sending"

This means:
- ✅ Cron job is running correctly
- ❌ No messages with status='scheduled' and scheduled_for in the past

**Check:**
1. Is the message status actually 'scheduled' (not 'draft' or 'sent')?
2. Is the `scheduled_for` time in the past?
3. Run `node test-scheduled-messages.js` to diagnose

### "Unauthorized" error

The `SUPABASE_SERVICE_ROLE_KEY` is not set or incorrect in Vercel environment variables.

### Message status changes to 'failed'

Check the `error_message` column. Common issues:
- No access token for the Facebook page
- No recipients found
- Facebook API error

## 📊 Current Database Status

As of the last check:
- **Scheduled messages:** 0
- **Sent messages:** 10
- **Failed messages:** 2
- **Cancelled messages:** 3

## 🚀 Next Steps

1. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel
2. Redeploy
3. Create a test scheduled message (5 minutes from now)
4. Wait and watch the Vercel cron logs
5. Verify the message is sent

The system is now ready to handle scheduled messages automatically! 🎉

