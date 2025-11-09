# Auto-Create Opportunities Feature - Complete!

## Overview

Implemented automatic opportunity creation for all scored leads that don't have opportunities yet. The system intelligently checks for existing opportunities and creates new ones with AI-determined pipeline stages and probabilities.

---

## What Was Implemented

### 1. New API Endpoint

**File:** `src/app/api/ai/auto-create-opportunities/route.ts`

**Endpoint:** `POST /api/ai/auto-create-opportunities`

**Features:**
- Checks for existing open opportunities (skips duplicates)
- Uses AI to classify appropriate pipeline stage for each contact
- Sets probability based on lead quality score
- Creates opportunities with $0 default value
- Logs activities for each created opportunity
- Returns detailed results (created count, skipped count)

**Request:**
```json
{
  "conversationIds": ["uuid-1", "uuid-2"],
  "pageId": "page-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "created": 15,
  "skipped": 5,
  "opportunities": [...]
}
```

---

### 2. Integration with Lead Scoring

**File Modified:** `src/app/api/ai/score-leads/route.ts`

**Added Parameter:** `autoCreateOpportunities` (boolean)

When enabled:
1. Scores all leads
2. Applies quality tags
3. Automatically creates opportunities for leads without them
4. Returns count of opportunities created

**Usage:**
```javascript
POST /api/ai/score-leads
{
  "conversationIds": [...],
  "autoTag": true,
  "autoCreateOpportunities": true  // NEW
}
```

---

### 3. UI Enhancements - Two Methods

**File Modified:** `src/app/dashboard/conversations/page.tsx`

#### Method 1: Separate "Auto-Create" Button ✨

New button added to Conversations page:
- **"Auto-Create X Opps"** - Purple-to-pink gradient
- Creates opportunities for selected contacts
- Skips contacts with existing open opportunities
- Shows creation results

#### Method 2: During Scoring

The existing "Score Leads" button now supports creating opportunities during scoring:
```typescript
handleScoreLeads(createOpportunities = false)
```

---

## How It Works

### Auto-Creation Process

```
1. User selects contacts (e.g., 50 contacts)
   ↓
2. Clicks "Auto-Create 50 Opps"
   ↓
3. System checks for existing opportunities
   ├─ 15 contacts already have opportunities → Skip
   └─ 35 contacts need opportunities → Process
   ↓
4. For each contact without opportunity:
   ├─ Get latest lead score (if scored)
   ├─ Use AI to classify pipeline stage
   ├─ Determine probability from quality
   └─ Create opportunity
   ↓
5. Results: "Created 35 opportunities. Skipped 15."
```

### Opportunity Settings

**Default Stage:**
- Uses AI stage classification
- Falls back to first pipeline stage if AI fails

**Value:**
- Always $0 (as requested)

**Probability:**
- Hot Lead (76-100 score) → 80%
- Warm Lead (51-75 score) → 60%
- Cold Lead (26-50 score) → 30%
- Unqualified (0-25 score) → 10%
- AI classification overrides if available

**Status:**
- Always "open"

**Title:**
- Format: "{Contact Name} - {Quality} Lead"
- Example: "Maria Santos - Hot Lead"

**Description:**
- AI reasoning from stage classification if available
- Falls back to lead scoring reasoning
- Default: "Automatically created opportunity"

---

## Usage Examples

### Example 1: Auto-Create for Scored Leads

```
1. Go to Conversations page
2. Select contacts (already scored)
3. Click "Auto-Create X Opps"
4. System creates opportunities only for contacts without them
5. Toast: "Created 25 opportunities. Skipped 5."
```

### Example 2: Score + Create in One Step

```
1. Go to Conversations page
2. Select unscored contacts
3. Click "Score X Leads"
4. Optionally enable "Create Opportunities" (future checkbox)
5. Both scoring and opportunity creation happen
6. Toast: "Scored 30 leads. Created 28 opportunities."
```

### Example 3: Bulk Processing

```
1. Sync 500 conversations from Facebook
2. Select all 500
3. Click "Auto-Create 500 Opps"
4. System:
   ├─ Checks existing opportunities (200 already exist)
   ├─ Scores remaining 300 (if not scored)
   ├─ Uses AI to classify stages
   └─ Creates 300 opportunities
5. Toast: "Created 300 opportunities. Skipped 200."
```

---

## Smart Features

### 1. Duplicate Prevention ✅
- Checks if contact already has an **open** opportunity
- Skips those contacts
- Only creates for contacts without opportunities
- Won't create duplicates

### 2. AI Stage Classification ✅
- Automatically determines best pipeline stage
- Based on conversation analysis
- Maps quality to appropriate stage:
  - Hot → Proposal Sent / Negotiation
  - Warm → Qualified
  - Cold → New Lead
  - Unqualified → New Lead

### 3. Quality-Based Probability ✅
- Hot leads: 80% probability
- Warm leads: 60% probability
- Cold leads: 30% probability
- Unqualified: 10% probability
- Can be overridden by AI classification

### 4. Graceful Fallbacks ✅
- If AI classification fails → Use first pipeline stage
- If lead not scored → Uses 50% probability
- If stage unavailable → Uses default stage
- System never fails completely

---

## UI Changes

### Conversations Page Action Buttons

**Before:**
```
[Score X Leads] [Send to X] [Create X Opps] [Tag X]
```

**After:**
```
[Score X Leads] [Auto-Create X Opps] [Send to X] [Manual Create] [Tag X]
```

**New Buttons:**
1. **"Auto-Create X Opps"** (Purple-pink gradient)
   - Creates opportunities automatically
   - Skips existing opportunities
   - Uses AI for stage assignment

2. **"Manual Create"** (Purple, renamed)
   - Opens bulk create form
   - Manual configuration
   - Full customization

---

## Benefits

✅ **One-Click Creation**
- No need to manually configure each opportunity
- Instant opportunity creation for qualified leads

✅ **Smart Duplicate Prevention**
- Never creates duplicate opportunities
- Checks for existing open opportunities
- Only creates when needed

✅ **AI-Powered Intelligence**
- Automatically assigns appropriate pipeline stage
- Sets realistic probability based on lead quality
- Uses conversation analysis for decisions

✅ **Bulk Processing**
- Create hundreds of opportunities in seconds
- Perfect for large lead imports
- Handles Facebook sync workflows

✅ **Quality-Aware**
- Hot leads get higher probabilities
- Appropriate stage placement
- Based on actual conversation data

✅ **Zero Configuration**
- Works out of the box
- No settings required
- $0 default value (clean pipeline)

---

## Technical Details

### Opportunity Creation Logic

```typescript
// 1. Check for existing opportunities
const existingOpportunities = await supabase
  .from('opportunities')
  .select('contact_id')
  .eq('status', 'open')
  .in('contact_id', contactIds);

// 2. Filter contacts that need opportunities
const needsOpportunities = contacts.filter(
  c => !existingContactIds.has(c.sender_id)
);

// 3. Classify stages with AI
const stageClassifications = await classifyStages(conversations);

// 4. Determine probability from quality
const probability = 
  quality === 'Hot' ? 80 :
  quality === 'Warm' ? 60 :
  quality === 'Cold' ? 30 : 10;

// 5. Create opportunities
await supabase.from('opportunities').insert(opportunities);
```

### Stage Mapping

| Lead Quality | Default Stage | Probability |
|--------------|---------------|-------------|
| Hot (76-100) | AI or Stage 4 | 80% |
| Warm (51-75) | AI or Stage 3 | 60% |
| Cold (26-50) | AI or Stage 2 | 30% |
| Unqualified (0-25) | AI or Stage 1 | 10% |

---

## Files Changed

### New Files (1):
1. `src/app/api/ai/auto-create-opportunities/route.ts` - Auto-creation API

### Modified Files (2):
1. `src/app/api/ai/score-leads/route.ts` - Added auto-create option
2. `src/app/dashboard/conversations/page.tsx` - Added UI buttons

---

## Future Enhancements (Optional)

### Potential Additions:
1. **Settings Page** - Configure default value, currency
2. **Checkbox Option** - "Create opportunities while scoring"
3. **Filter by Quality** - "Auto-create only for Hot/Warm leads"
4. **Custom Templates** - Title and description templates
5. **Bulk Edit** - Update created opportunities en masse

---

## Testing Checklist

- [x] Create opportunities for unscored contacts
- [x] Skip contacts with existing opportunities
- [x] Use AI stage classification
- [x] Set appropriate probabilities
- [x] Handle large batches (100+ contacts)
- [x] Show accurate creation/skip counts
- [x] Log opportunity activities
- [x] Graceful error handling

---

## 🎉 Implementation Complete!

You can now automatically create opportunities for all your scored leads with a single click. The system intelligently:
- Skips duplicates
- Assigns appropriate stages
- Sets realistic probabilities
- Works with any number of contacts

Perfect for:
- Processing large lead imports
- Converting Facebook sync results
- Quickly populating your pipeline
- Reducing manual data entry

