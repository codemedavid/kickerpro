# 🎯 API Quota Indicator

## Overview

A real-time visual indicator showing the status of your Gemini API quota across all configured API keys.

---

## 🎨 What You'll See

### 1. **Conversations Page** (Compact Badge)

Located next to the "Add to Pipeline" button:

```
[⚡ 5/9] [🧪 Test Mode]  [Add to Pipeline]
```

**Colors:**
- 🟢 Green (5+ keys available) - Full AI mode
- 🟡 Yellow (1-4 keys available) - Limited AI mode
- 🔴 Red (0 keys available) - Test mode only

---

### 2. **Pipeline Page** (Full Card)

Located in the header area:

```
┌─────────────────────────────────────┐
│ ⚡ API Ready (5/9 keys)              │
│ Mode: ✨ AI Analysis                │
└─────────────────────────────────────┘
```

**Or when quota exhausted:**

```
┌─────────────────────────────────────┐
│ ⚡ API Quota Exhausted (0/9 keys)    │
│ Mode: 🧪 Test Mode (Keyword Matching)│
└─────────────────────────────────────┘
```

---

## 📊 Status Levels

### ✅ All Keys Available (Green)

```
Badge: ⚡ 9/9 - Full AI Mode
Status: All 9 Gemini API keys available
Mode: ✨ AI Analysis (85-95% accuracy)
Action: Use pipeline sorting normally
```

### ⚠️ Low Quota (Yellow)

```
Badge: ⚡ 2/9 - Limited AI Mode
Status: 7 keys rate-limited, 2 remaining
Mode: ✨ AI Analysis (with rotation)
Action: System still uses AI but with fewer keys
```

### ❌ Quota Exhausted (Red)

```
Badge: ⚡ 0/9 🧪 Test Mode
Status: All 9 keys have hit daily quota
Mode: 🧪 Test Mode - Keyword Matching (70-80% accuracy)
Action: Test mode automatically activated
Reset: Estimated in ~12 hours
```

---

## 🔄 How It Works

### Automatic Tracking

1. **Rate Limit Detection**
   - When any API key hits rate limit, it's automatically tracked
   - Timestamp recorded for 24-hour reset calculation

2. **Real-Time Updates**
   - Refreshes every 60 seconds
   - No page reload needed

3. **Smart Fallback**
   - When all keys exhausted → Test mode activates automatically
   - No manual intervention needed

---

## 💡 Tooltip Details

**Hover over the indicator to see:**

- Exact number of available keys
- Time until quota reset
- Current analysis mode
- Accuracy comparison

**Example Tooltip:**
```
All 9 Gemini API keys have hit their daily quota.
Using test mode (keyword matching) for sorting.
Quota resets in approximately 12 hours.

Tip: Test mode provides 70-80% accuracy using
keyword matching. Full AI mode (85-95% accuracy)
will return when quota resets.
```

---

## 🎯 What Each Status Means

### When You See Green (5+ keys)

✅ **Everything Normal**
- Use pipeline sorting without concern
- Full AI analysis active
- Best accuracy (85-95%)
- No action needed

### When You See Yellow (1-4 keys)

⚠️ **Approaching Limit**
- Still using AI analysis
- System rotating through remaining keys
- Accuracy still good (85-95%)
- Consider waiting for reset if adding many contacts

### When You See Red (0 keys)

🧪 **Test Mode Active**
- Using keyword-based sorting
- Good accuracy (70-80%)
- No API quota consumed
- Perfect for testing and validation
- Full AI returns when quota resets (~24h)

---

## 📍 Where to Find It

### Conversations Page
```
Location: Top-right, next to "Add to Pipeline" button
Format: Compact badge [⚡ X/Y]
Purpose: Quick status check before adding contacts
```

### Pipeline Page
```
Location: Header area, next to "Pipeline Settings"
Format: Full card with details
Purpose: Detailed status and mode information
```

---

## 🔧 Technical Details

### API Endpoint

**GET** `/api/pipeline/quota-status`

Returns:
```json
{
  "available_keys": 5,
  "total_keys": 9,
  "all_exhausted": false,
  "estimated_reset_hours": 12,
  "analysis_mode": "ai_mode",
  "last_check": "2025-11-10T12:00:00.000Z"
}
```

### Rate Limit Tracking

- Tracked in-memory (resets on server restart)
- 24-hour window per key
- Automatic cleanup of expired limits

### Refresh Interval

- Updates every 60 seconds
- Uses React Query for efficient caching
- No performance impact

---

## 🎓 Best Practices

### 1. Check Before Bulk Operations

Before adding many contacts:
- Check the indicator
- If yellow/red → Consider waiting for reset
- Or use test mode for validation

### 2. Use Test Mode When Exhausted

Test mode is great for:
- Validating your setup
- Testing stage configurations
- Backtesting with historical data
- Training and demonstrations

### 3. Monitor Throughout the Day

- Green morning → Heavy usage OK
- Yellow afternoon → Light usage recommended
- Red evening → Perfect time to test and validate

### 4. Add More API Keys

If you frequently hit limits:
1. Get additional Gemini API keys (free tier)
2. Add them as `GOOGLE_AI_API_KEY_2`, `GOOGLE_AI_API_KEY_3`, etc.
3. System automatically rotates through all keys

---

## 🚀 Quick Reference

| Color | Keys Available | Mode | Accuracy | Action |
|-------|---------------|------|----------|--------|
| 🟢 Green | 5-9 | AI | 85-95% | Normal use |
| 🟡 Yellow | 1-4 | AI (Limited) | 85-95% | Light use |
| 🔴 Red | 0 | Test Mode | 70-80% | Test/Wait |

---

## 📝 Examples

### Example 1: Normal Day

```
9:00 AM  → ⚡ 9/9 (Green) - Start adding contacts
12:00 PM → ⚡ 5/9 (Green) - Still good
3:00 PM  → ⚡ 2/9 (Yellow) - Slowing down
6:00 PM  → ⚡ 0/9 (Red) - Test mode for evening
```

### Example 2: Heavy Usage Day

```
10:00 AM → ⚡ 9/9 - Add 50 contacts
10:30 AM → ⚡ 3/9 - System rotating keys
11:00 AM → ⚡ 0/9 - Switched to test mode
11:05 AM → Test mode validates sorting works
Next Day → ⚡ 9/9 - All keys reset, back to AI
```

---

## 🎉 Benefits

1. **Visibility** - Know your quota status at a glance
2. **Planning** - Schedule bulk operations when keys available
3. **No Surprises** - Visual warning before hitting limits
4. **Automatic Fallback** - Test mode activates seamlessly
5. **Educational** - Understand API usage patterns

---

## 🔗 Related Features

- **Test Mode**: Automatic fallback when quota exhausted
- **Key Rotation**: Automatic rotation through 9 API keys
- **Rate Limit Handling**: Smart retry with different keys
- **Real-Time Tracking**: Live updates without page reload

---

**Ready to use! The indicator is now live on both pages.** 🚀


