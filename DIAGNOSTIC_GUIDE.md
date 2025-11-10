# 🔍 Diagnostic Tool - Find Why Messages Are Stuck

## Quick Start

### Step 1: Run Diagnostics

Visit this URL in your browser:
```
http://localhost:3000/api/messages/diagnose
```

### Step 2: Review the Report

You'll see a detailed report like this:

```json
{
  "status": "found_issues",
  "total_stuck": 2,
  "diagnostics": [
    {
      "message": {
        "id": "msg-123",
        "title": "wada",
        "status": "sending",
        "stuck_for_minutes": 15,
        "error_message": null
      },
      "batches": {
        "total": 1,
        "pending": 1,
        "completed": 0,
        "total_sent": 0
      },
      "diagnosis": {
        "issues": [
          "All batches are still pending - processing never started"
        ],
        "recommendations": [
          "Trigger batch processing manually"
        ],
        "severity": "high"
      }
    }
  ]
}
```

### Step 3: Force Fix

To automatically fix a stuck message:

**Method 1: Use curl/Postman:**
```bash
POST http://localhost:3000/api/messages/diagnose
Content-Type: application/json

{
  "messageId": "your-message-id-here"
}
```

**Method 2: Visit rescue endpoint:**
```
http://localhost:3000/api/messages/rescue-stuck
```

---

## What the Diagnostics Check

### 1. **No Batches Created**
- **Issue**: Message has no batch records
- **Fix**: Mark as failed and retry
- **Severity**: Critical

### 2. **Batches Stuck Pending**
- **Issue**: Batches created but never started processing
- **Fix**: Trigger processing manually
- **Severity**: High

### 3. **Batches Stuck Processing**
- **Issue**: Batch started but never finished
- **Fix**: Mark as failed, retry
- **Severity**: High

### 4. **Batches Complete, Status Wrong**
- **Issue**: All batches done but message still shows "sending"
- **Fix**: Update message status
- **Severity**: Medium

### 5. **Missing Access Token**
- **Issue**: Facebook page token is gone
- **Fix**: Reconnect page
- **Severity**: Critical

### 6. **Stuck Too Long**
- **Issue**: Message stuck > 10 minutes
- **Fix**: Investigate logs, force fix
- **Severity**: High

---

## Common Fixes

### Fix 1: Rescue All Stuck Messages
```
GET http://localhost:3000/api/messages/rescue-stuck
```
Automatically finds and fixes all stuck messages.

### Fix 2: Force Fix Specific Message
```
POST http://localhost:3000/api/messages/diagnose
Body: { "messageId": "msg-123" }
```
Forces a specific message to update its status.

### Fix 3: Trigger Batch Processing
```
POST http://localhost:3000/api/messages/{messageId}/batches/process
```
Manually triggers batch processing.

---

## Example Scenarios

### Scenario 1: "Processing Never Started"

**Diagnostic Output:**
```json
{
  "issues": ["All batches are still pending"],
  "recommendations": ["Trigger batch processing manually"],
  "severity": "high"
}
```

**Solution:**
1. Visit `/api/messages/rescue-stuck`
2. Or POST to `/api/messages/{id}/batches/process`

### Scenario 2: "Status Not Updated"

**Diagnostic Output:**
```json
{
  "issues": ["All batches completed but message status not updated"],
  "suggested_status": "sent",
  "severity": "medium"
}
```

**Solution:**
1. POST to `/api/messages/diagnose` with messageId
2. Will auto-update to correct status

### Scenario 3: "Batch Crashed"

**Diagnostic Output:**
```json
{
  "issues": ["Batch 1 has been processing for 15 minutes"],
  "severity": "high"
}
```

**Solution:**
1. Check server logs for errors
2. Visit `/api/messages/rescue-stuck`
3. Will mark batch as failed and update message

---

## Quick Reference

| URL | Method | Purpose |
|-----|--------|---------|
| `/api/messages/diagnose` | GET | See all stuck messages with details |
| `/api/messages/diagnose` | POST | Force fix specific message |
| `/api/messages/rescue-stuck` | GET | Auto-fix all stuck messages |
| `/api/messages/{id}/batches/process` | POST | Manually trigger processing |

---

## Next Steps

1. **Run** `/api/messages/diagnose` to see what's wrong
2. **Copy** the output
3. **Share** it with me so I can help further
4. **Try** the recommended fixes

The diagnostic tool will tell us exactly what's happening!









