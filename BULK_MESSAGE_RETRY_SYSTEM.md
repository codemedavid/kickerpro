# 🔄 Bulk Message Retry & Failed Delivery Tracking System

## 📋 Overview

This comprehensive system adds advanced retry and failure tracking capabilities to the bulk messaging feature, including:

✅ **Individual Delivery Tracking** - Track each recipient's delivery status  
✅ **Failed Recipient Management** - View and manage failed deliveries by error type  
✅ **Unlimited Batching** - Process any number of recipients in batches of 100  
✅ **Multiple Retry Options** - Manual, auto, and scheduled retry methods  
✅ **Error Categorization** - Intelligently categorize errors (access token, rate limit, network, etc.)  
✅ **Selective Resend** - Retry specific recipients or error types  
✅ **Auto-Retry Cron Job** - Automated scheduled retries  

---

## 🗄️ Database Schema Changes

### New Table: `message_deliveries`

Tracks individual delivery attempts to each recipient:

```sql
CREATE TABLE message_deliveries (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL,
    batch_id UUID,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT,
    status TEXT NOT NULL, -- 'pending', 'sending', 'sent', 'failed', 'cancelled'
    attempt_number INTEGER DEFAULT 1,
    facebook_message_id TEXT,
    error_code TEXT,
    error_message TEXT,
    error_type TEXT, -- 'access_token', 'rate_limit', 'invalid_recipient', 'network', 'other'
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Updated Table: `messages`

Added retry configuration fields:

```sql
ALTER TABLE messages ADD COLUMN:
- auto_retry_enabled BOOLEAN DEFAULT false
- retry_type TEXT DEFAULT 'manual' -- 'manual', 'auto', 'cron'
- max_retry_attempts INTEGER DEFAULT 3
- retry_count INTEGER DEFAULT 0
```

### New Database Functions

**`get_retryable_recipients(message_id, max_attempts)`**
- Returns recipients that failed but haven't exceeded max retry attempts
- Groups by recipient and shows last error details

**`cleanup_old_deliveries(days_to_keep)`**
- Cleanup old successful/cancelled delivery records for maintenance

### New Database View

**`failed_deliveries_summary`**
- Provides summary of failed deliveries grouped by message and error type
- Useful for analytics and reporting

---

## 🚀 How to Set Up

### 1. Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# Run this file in Supabase SQL Editor
add-message-delivery-tracking.sql
```

### 2. Deploy to Vercel

The cron job is automatically configured in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/retry-failed",
    "schedule": "*/15 * * * *"  // Every 15 minutes
  }]
}
```

### 3. Set Environment Variable (Optional)

For production security, add a cron secret:

```env
CRON_SECRET=your-secret-key-here
```

---

## 💡 Features & Usage

### 1. Unlimited Batching (FIXED)

**Problem Solved:** Messages weren't being sent to all selected contacts

**Solution:** 
- System now processes ALL batches sequentially
- Removed early break logic that stopped batch processing prematurely
- Supports unlimited recipients (batches of 100 each)

**Example:**
- Select 5,000 contacts → Creates 50 batches of 100
- All 50 batches are processed sequentially
- Progress tracked in real-time

---

### 2. Retry Configuration (During Compose)

When composing a message, you can configure automatic retry:

#### **Option 1: Manual Retry** (Default)
- You manually click "View Failed & Retry" button
- Review failed recipients by error type
- Selectively retry specific recipients or error types

#### **Option 2: Auto Retry (Immediate)**
- Automatically retries failed deliveries after initial send completes
- No manual intervention needed
- Retries happen immediately in the same session

#### **Option 3: Scheduled Retry (Cron Job)**
- Automatically retries failed deliveries every 15 minutes
- Continues until successful or max attempts reached
- Runs in background via Vercel Cron Jobs

**UI Location:** Compose page → "Automatic Retry (Optional)" section

**Settings:**
- Enable/disable automatic retry
- Select retry method
- Set max retry attempts (1-10)

---

### 3. View Failed Recipients

#### **Access:**
- Go to **Dashboard → History**
- Find messages with status: **Failed**, **Partially Sent**, or **Sent** (with failures)
- Click **"View Failed & Retry"** button

#### **Features:**
- **Stats Summary**: Shows sent/failed/retryable counts
- **Error Type Filters**: Filter by access_token, rate_limit, network, etc.
- **Individual Recipient Details**: See error messages and attempt counts
- **Selective Retry**: Choose specific recipients or error types

#### **Error Types:**
| Error Type | Icon | Description |
|------------|------|-------------|
| `access_token` | 🔑 | Access token expired or invalid |
| `rate_limit` | ⏰ | Facebook rate limit exceeded |
| `network` | 📶 | Network connection issues |
| `invalid_recipient` | 🚫 | Recipient ID invalid or not found |
| `permission` | ⛔ | Permission denied |
| `other` | ⚠️ | Other errors |

---

### 4. Resend Failed Messages

#### **Resend All Retryable Recipients**
```typescript
Click "Retry All (X)" button
```
- Retries all recipients who haven't exceeded max attempts
- Creates new batches and processes them

#### **Resend Selected Recipients**
```typescript
1. Check individual recipients
2. Click "Retry Selected (X)"
```
- Only retries checked recipients

#### **Resend by Error Type**
```typescript
1. Click error type filter badges (e.g., "Access Token Error")
2. Click "Retry Selected (1 type)"
```
- Retries all recipients with that error type
- Useful for retrying after fixing a specific issue (e.g., refreshing access token)

---

### 5. Automatic Retry (Cron Job)

#### **How It Works:**

1. **Cron Job Runs** (every 15 minutes)
   ```
   GET /api/cron/retry-failed
   ```

2. **Finds Messages** with:
   - `auto_retry_enabled = true`
   - `retry_type = 'cron'`
   - `retry_count < max_retry_attempts`
   - Status: `sent`, `failed`, or `sending`

3. **For Each Message:**
   - Gets retryable failed recipients
   - Creates new retry batches
   - Triggers batch processing
   - Updates retry count

4. **Stops When:**
   - All recipients successful
   - Max retry attempts reached
   - No more retryable recipients

#### **Monitor Cron Job:**
```bash
# Check Vercel deployment logs
vercel logs --follow

# Or check in Vercel dashboard
Project → Settings → Cron Jobs
```

---

## 🔍 API Endpoints

### Get Failed Recipients
```http
GET /api/messages/{messageId}/failed-recipients
```

**Response:**
```json
{
  "success": true,
  "message_id": "...",
  "failed_recipients": [
    {
      "recipient_id": "...",
      "recipient_name": "John Doe",
      "last_error_message": "Access token expired",
      "last_error_type": "access_token",
      "attempt_count": 2
    }
  ],
  "retryable_count": 45,
  "error_type_counts": {
    "access_token": 30,
    "rate_limit": 10,
    "network": 5
  },
  "stats": {
    "sent": 955,
    "failed": 45,
    "total": 1000
  },
  "max_retry_attempts": 3
}
```

### Resend to Failed Recipients
```http
POST /api/messages/{messageId}/resend
```

**Body (Optional):**
```json
{
  "recipient_ids": ["psid1", "psid2"],  // Optional: specific recipients
  "error_types": ["access_token"]       // Optional: specific error types
}
```

**Response:**
```json
{
  "success": true,
  "message": "Retry batches created and processing started",
  "recipients_to_retry": 45,
  "batches": {
    "total": 1,
    "size": 100,
    "start_number": 11
  }
}
```

### Auto-Retry Cron Job
```http
GET /api/cron/retry-failed
Authorization: Bearer {CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "message": "Retry job completed: 3 messages processed",
  "processed": 3,
  "total_recipients": 145,
  "results": [
    {
      "message_id": "...",
      "title": "Welcome Message",
      "status": "retrying",
      "recipients_count": 45,
      "batches_created": 1,
      "retry_attempt": 2
    }
  ]
}
```

---

## 📊 Tracking & Analytics

### Database Queries

**Get delivery success rate:**
```sql
SELECT 
    m.title,
    COUNT(*) FILTER (WHERE md.status = 'sent') as sent,
    COUNT(*) FILTER (WHERE md.status = 'failed') as failed,
    ROUND(COUNT(*) FILTER (WHERE md.status = 'sent')::numeric / COUNT(*)::numeric * 100, 2) as success_rate
FROM messages m
LEFT JOIN message_deliveries md ON md.message_id = m.id
WHERE md.attempt_number = 1  -- First attempt only
GROUP BY m.id, m.title;
```

**Get most common errors:**
```sql
SELECT 
    error_type,
    COUNT(*) as error_count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER() * 100, 2) as percentage
FROM message_deliveries
WHERE status = 'failed'
GROUP BY error_type
ORDER BY error_count DESC;
```

**Get retry effectiveness:**
```sql
SELECT 
    attempt_number,
    COUNT(*) FILTER (WHERE status = 'sent') as successful_retries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_retries
FROM message_deliveries
WHERE attempt_number > 1
GROUP BY attempt_number
ORDER BY attempt_number;
```

---

## 🎯 Best Practices

### 1. **Retry Strategy Selection**

| Scenario | Recommended Strategy |
|----------|---------------------|
| One-time campaign | Manual retry |
| Important urgent messages | Auto retry (immediate) |
| Long-running campaigns | Scheduled retry (cron) |
| Access token issues | Cron (gives time to refresh token) |
| Rate limiting | Cron (spreads retries over time) |

### 2. **Max Retry Attempts**

| Message Priority | Recommended Max Attempts |
|------------------|--------------------------|
| Low priority (newsletters) | 1-2 retries |
| Medium priority (updates) | 3 retries (default) |
| High priority (critical alerts) | 5-10 retries |

### 3. **Error Handling**

**Access Token Errors:**
1. Refresh Facebook page access token
2. Use cron retry to automatically retry after token refresh

**Rate Limit Errors:**
1. Let cron job handle retries (spreads over time)
2. Don't manually retry immediately

**Network Errors:**
1. Auto retry often resolves these
2. Usually transient issues

**Invalid Recipient Errors:**
1. Don't retry (will never succeed)
2. Clean up your recipient list

---

## 🔧 Troubleshooting

### Issue: Batches Not Processing

**Check:**
```sql
SELECT * FROM message_batches 
WHERE message_id = 'your-message-id'
ORDER BY batch_number;
```

**Fix:**
- Ensure `status` is `pending` or `processing`
- Check for stuck batches (processing > 10 minutes)
- Manually trigger process: `POST /api/messages/{id}/batches/process`

### Issue: Cron Job Not Running

**Check:**
1. Vercel Cron Jobs configured in `vercel.json`
2. Environment variable `CRON_SECRET` set (if used)
3. Check Vercel logs: `vercel logs --follow`

**Fix:**
1. Redeploy to Vercel
2. Verify cron schedule syntax
3. Test manually: `GET /api/cron/retry-failed`

### Issue: Duplicate Deliveries

**Check:**
```sql
SELECT recipient_id, COUNT(*) as attempt_count
FROM message_deliveries
WHERE message_id = 'your-message-id' AND status = 'sent'
GROUP BY recipient_id
HAVING COUNT(*) > 1;
```

**This shouldn't happen** - the system filters out successful recipients from retries.

---

## 📈 Performance Considerations

### Scalability

| Recipients | Batches | Processing Time | Notes |
|------------|---------|-----------------|-------|
| 100 | 1 | ~10 seconds | Direct processing |
| 1,000 | 10 | ~2 minutes | Batch processing |
| 10,000 | 100 | ~20 minutes | Async background |
| 100,000 | 1,000 | ~3 hours | Distributed batches |

**Optimization Tips:**
- Batch size: 100 (optimal for Facebook API)
- Delay between messages: 100ms (rate limit protection)
- Cron frequency: 15 minutes (balance between speed and server load)

### Database Cleanup

**Recommended:** Run cleanup monthly

```sql
SELECT cleanup_old_deliveries(90); -- Remove records older than 90 days
```

This removes successful and cancelled delivery records older than specified days, keeping only failed deliveries for retry tracking.

---

## 🎉 Summary of Improvements

### ✅ What Was Fixed

1. **Unlimited Batching** - Now processes ALL batches, not just the first one
2. **Missing Failure Tracking** - Individual delivery attempts now logged
3. **No Retry Mechanism** - Added 3 retry methods (manual, auto, cron)
4. **No Error Categorization** - Errors now categorized by type
5. **No Failed Recipients View** - Added comprehensive UI to view and manage failures

### 🚀 What Was Added

1. **Database Tables & Functions** - Complete delivery tracking infrastructure
2. **Retry APIs** - Endpoints to fetch and resend to failed recipients
3. **UI Components** - FailedRecipientsDialog with rich filtering
4. **Cron Job** - Automated retry system
5. **Compose Options** - Configure retry during message composition
6. **Analytics Support** - Database views and queries for insights

---

## 📝 Migration Checklist

- [x] Run database migration: `add-message-delivery-tracking.sql`
- [x] Deploy to Vercel (cron job auto-configured)
- [x] Set `CRON_SECRET` environment variable (optional but recommended)
- [x] Test sending a message with retry enabled
- [x] Test viewing failed recipients
- [x] Test manual resend
- [x] Monitor cron job logs
- [x] Clean up old delivery records monthly

---

## 🎓 Examples

### Example 1: Send with Auto Retry

```typescript
// User composes message in UI
// 1. Go to Dashboard → Compose
// 2. Fill in message details
// 3. Select recipients (e.g., 5000 contacts)
// 4. Enable "Automatic Retry"
// 5. Choose "Auto Retry (Immediate)"
// 6. Set max attempts: 3
// 7. Click "Send Now"

// Result:
// - Message sent to 5000 recipients in 50 batches
// - 4,950 succeed, 50 fail (access token expired)
// - System automatically retries 50 failed recipients
// - 45 succeed on retry, 5 still fail
// - User can manually view and retry the remaining 5
```

### Example 2: Selective Retry by Error Type

```typescript
// After sending, some deliveries failed
// 1. Go to Dashboard → History
// 2. Find message with failures
// 3. Click "View Failed & Retry"
// 4. See error summary:
//    - Access Token Error: 30
//    - Rate Limit: 10
//    - Network: 5
// 5. Refresh Facebook access token
// 6. Click "Access Token Error (30)" filter
// 7. Click "Retry Selected (1 type)"

// Result:
// - Only retries the 30 access token failures
// - Leaves rate limit and network errors for cron job
```

### Example 3: Scheduled Retry for Long Campaign

```typescript
// Sending important campaign
// 1. Compose message
// 2. Select all active recipients
// 3. Enable "Automatic Retry"
// 4. Choose "Scheduled Retry (Cron Job)"
// 5. Set max attempts: 5
// 6. Click "Send Now"

// Result:
// - Initial send completes
// - Cron job runs every 15 minutes
// - Retries failed deliveries up to 5 times
// - Continues over several hours until all succeed or max attempts reached
// - No manual intervention needed
```

---

## 🔐 Security Notes

- Cron endpoint protected by `CRON_SECRET`
- User authentication required for all retry operations
- Message ownership verified before allowing retries
- Rate limiting respected via delays

---

## 📞 Support

If you encounter issues:

1. Check database for stuck batches
2. Review Vercel logs for errors
3. Test APIs manually using provided endpoints
4. Verify environment variables are set correctly

---

**Built with ❤️ for reliable bulk messaging**

