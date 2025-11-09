# ❌ Fix MAX_TOKENS Error in AI Generation

## The Error

```
Error: No content in Google AI response
Finish reason: MAX_TOKENS
promptTokenCount: 1016
thoughtsTokenCount: 1999
totalTokenCount: 3015
```

**The AI is using too many tokens before generating your message!**

---

## 🔍 The Cause

Your AI prompt is probably very long with:
- Custom instructions
- Previous message history
- Anti-repetition requirements
- Context from conversation

**Result:** AI runs out of tokens before writing the message!

---

## ✅ Solutions

### **Solution 1: Shorten Your Custom Prompt (Fastest)**

1. Go to: **Dashboard → AI Automations → "test 2" → Edit**
2. Find: **AI Prompt Instructions**
3. **Shorten it!** Current version is too verbose.

**Before (Too Long):**
```
You are a helpful assistant for a coffee business.
Reference their previous conversation about bulk orders.
Be friendly and professional.
Use Taglish (mix of Tagalog and English).
Make sure to mention our special promotions.
Ask if they have any questions.
Keep it conversational and engaging.
Don't be too pushy but be persistent.
[... more instructions ...]
```

**After (Concise):**
```
Write in Taglish.
Reference their inquiry.
Keep it 2-3 sentences.
Ask if still interested.
```

### **Solution 2: Limit Previous Message History**

The system shows previous messages to avoid repetition. Let me reduce that:

<function_calls>
<invoke name="read_file">
<parameter name="target_file">src/app/api/cron/ai-automations/route.ts

