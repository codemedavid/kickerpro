# 🎯 AI-Powered Sales Pipeline System

## Overview

The Sales Pipeline system is an intelligent contact management tool that uses AI to automatically categorize your Facebook Messenger contacts into different stages of your sales funnel. It features a dual-prompt analysis system where both global and stage-specific criteria must agree for confident placement.

---

## 🚀 Features

### ✨ Core Capabilities

1. **AI-Driven Stage Analysis**
   - Dual-prompt system (Global + Stage-specific)
   - Confidence scoring for each placement
   - Automatic categorization based on conversation history

2. **Visual Kanban-Style Pipeline**
   - Drag-and-drop interface (via click-to-move)
   - Color-coded stages
   - Real-time contact counts

3. **Manual Override**
   - Move contacts between stages manually
   - Override AI decisions when needed
   - Maintain audit trail of movements

4. **Flexible Stage Management**
   - Create unlimited custom stages
   - Define specific AI criteria for each stage
   - Reorder stages by position

---

## 📋 How It Works

### Step 1: Initial Setup

#### Automatic Default Stage

When you first visit the Sales Pipeline page, a default **"Unmatched"** stage is automatically created for you. This stage serves as:
- A holding area for newly added contacts
- A review queue for contacts where AI prompts disagree
- A catch-all for contacts that don't fit defined stages

#### Configure Global Settings

1. Navigate to **Dashboard → Sales Pipeline**
2. Click **"Pipeline Settings"**
3. Enter your global analysis prompt:

```
Example:
Analyze this contact based on their conversation history.
Consider their engagement level, purchase intent, and where
they are in the buying journey. Look for:
- How recently they've messaged
- Questions about products/pricing
- Expressions of interest or objections
- Level of engagement with responses
```

This global prompt provides the overall framework for analyzing contacts.

#### Create Pipeline Stages

1. Click **"Add Stage"**
2. Fill in stage details:
   - **Name**: e.g., "New Lead", "Qualified", "Negotiation", "Won"
   - **Description**: Brief explanation of the stage
   - **Color**: Visual identifier (8 colors available)
   - **Analysis Prompt**: Specific criteria for this stage

```
Example for "Qualified Lead" stage:
A contact belongs in this stage if they have:
- Asked specific questions about products or services
- Shown interest in pricing or purchasing
- Responded positively to initial outreach
- Engaged within the last 7 days
```

3. Create multiple stages to represent your sales funnel

---

### Step 2: Add Contacts to Pipeline

#### From Conversations Page

1. Go to **Dashboard → Conversations**
2. Select contacts you want to analyze (use checkboxes)
3. Click **"Add to Pipeline"** button
4. Contacts are added to "Unmatched" stage by default

---

### Step 3: AI Analysis

#### Automatic Analysis

1. Click **"Analyze All Contacts"** on the Pipeline page
2. AI processes each contact through dual-prompt system:

**Dual-Prompt System:**

```
┌─────────────────────────────────────────┐
│  Global Analysis                        │
│  ↓                                      │
│  "Which stage should this contact       │
│   be in overall?"                       │
│  ↓                                      │
│  Recommended: "Qualified Lead"          │
└─────────────────────────────────────────┘
           ↓
           ↓ COMPARE
           ↓
┌─────────────────────────────────────────┐
│  Stage-Specific Analysis                │
│  ↓                                      │
│  For each stage, check:                 │
│  "Does this contact meet the specific   │
│   criteria for this stage?"             │
│  ↓                                      │
│  "Qualified Lead": YES (Confidence: 85%)│
└─────────────────────────────────────────┘
           ↓
           ↓
    ┌──────────────┐
    │  DECISION    │
    └──────────────┘
           │
           ├─ BOTH AGREE? → Move to recommended stage ✅
           │                 (High confidence)
           │
           └─ DISAGREE?   → Move to "Unmatched" ⚠️
                            (Requires manual review)
```

#### What Gets Analyzed

For each contact, AI reviews:
- Full conversation history (up to 10 most recent messages)
- Sender name and ID
- Last message content and timestamp
- Message frequency and recency

---

### Step 4: Review and Manage

#### Understanding the Results

**Contact Card Badges:**

- **✓ Agreed**: Both prompts agreed on placement (high confidence)
- **⚠ Manual**: Prompts disagreed, needs manual review
- **Manual**: Contact was manually moved by user
- **85%**: AI confidence score

#### Manual Override

1. Click on any contact card
2. View contact details and current stage
3. Select a new stage from the available options
4. Contact is moved and marked as "Manually Assigned"

---

## 🎨 Visual Guide

### Pipeline Page Layout

```
┌────────────────────────────────────────────────────┐
│  📊 Stats Dashboard                                │
│  • Total Contacts  • AI Analyzed  • Prompts Agreed │
└────────────────────────────────────────────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ New Lead    │  │ Qualified   │  │ Negotiation │
│ 🔵 Blue     │  │ 🟢 Green    │  │ 🟣 Purple   │
├─────────────┤  ├─────────────┤  ├─────────────┤
│             │  │             │  │             │
│ • John Doe  │  │ • Jane S.   │  │ • Mike T.   │
│   ✓ Agreed  │  │   ⚠ Manual  │  │   Manual    │
│   90%       │  │             │  │             │
│             │  │ • Sarah W.  │  │             │
│ • Bob Smith │  │   ✓ Agreed  │  │             │
│   ✓ Agreed  │  │   85%       │  │             │
│   75%       │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## 🔧 Advanced Configuration

### Default/Unmatched Stage

The system automatically creates an "Unmatched" stage for contacts that:
- Haven't been analyzed yet
- AI prompts disagreed on placement
- Don't clearly fit any defined stage

This stage acts as a review queue for manual sorting.

### Stage Position

Stages are displayed left-to-right by their `position` value:
- Lower numbers appear first (left)
- Typically represents sales funnel progression
- Can be reordered by editing stage position

### Confidence Scoring

AI provides a confidence score (0-100%) based on:
- How well conversation matches criteria
- Clarity of signals in messages
- Agreement between global and stage prompts

---

## 📊 Use Cases

### Example 1: E-commerce Business

**Stages:**
1. **Browser** (🔵 Blue)
   - Asked about products
   - No pricing questions yet
   - Recent engagement (last 14 days)

2. **Interested** (🟢 Green)
   - Asked about pricing
   - Requested more details
   - Responded to product recommendations

3. **Ready to Buy** (🟣 Purple)
   - Asked about payment/shipping
   - Expressed intent to purchase
   - Active in last 3 days

4. **Customer** (🟡 Yellow)
   - Completed purchase
   - Post-purchase messages
   - Potential upsell opportunity

### Example 2: Service Business

**Stages:**
1. **Inquiry** - Initial contact, asking questions
2. **Consultation Scheduled** - Booked a call/meeting
3. **Proposal Sent** - Received quote or proposal
4. **Negotiation** - Discussing terms, pricing
5. **Won** - Became a client
6. **Lost** - Decided not to proceed

---

## 🎯 Best Practices

### Writing Effective Prompts

**Global Prompt Tips:**
- Be comprehensive but not too specific
- Define overall decision framework
- Include timeframe considerations (recency)
- Consider engagement patterns

**Stage-Specific Prompt Tips:**
- Be very specific about criteria
- Use concrete indicators (keywords, actions)
- Include examples of qualifying behaviors
- Define exclusion criteria (what doesn't qualify)

### Prompt Examples

**Good Global Prompt:**
```
Analyze this contact's readiness to purchase based on:
1. How recently they've engaged (last message date)
2. Specificity of their questions
3. Price/product inquiries
4. Tone of messages (enthusiastic vs. hesitant)
5. Number of touchpoints

Recommend the stage that best matches their current position
in the buying journey.
```

**Good Stage Prompt (for "Hot Lead"):**
```
A contact is a Hot Lead if they have:
- Messaged within the last 48 hours
- Asked specific questions about pricing or availability
- Expressed urgency ("need it soon", "when can I get")
- Responded positively to product suggestions
- NOT yet committed to purchase (if committed, they're in Closing)
```

---

## 🔍 API Endpoints

### Pipeline Stages
- `GET /api/pipeline/stages` - Fetch all stages
- `POST /api/pipeline/stages` - Create new stage
- `PATCH /api/pipeline/stages` - Update stage
- `DELETE /api/pipeline/stages?id={id}` - Delete stage

### Pipeline Opportunities
- `GET /api/pipeline/opportunities` - Fetch all contacts
- `GET /api/pipeline/opportunities/{id}` - Get single contact
- `POST /api/pipeline/opportunities/bulk` - Add multiple contacts
- `PATCH /api/pipeline/opportunities/{id}` - Update/move contact
- `DELETE /api/pipeline/opportunities/{id}` - Remove from pipeline

### Analysis
- `POST /api/pipeline/analyze` - Analyze contacts with AI
  ```json
  {
    "opportunity_ids": ["uuid1", "uuid2", ...]
  }
  ```

### Settings
- `GET /api/pipeline/settings` - Fetch settings
- `POST /api/pipeline/settings` - Save settings
  ```json
  {
    "global_analysis_prompt": "Your prompt here",
    "auto_analyze": true
  }
  ```

---

## 🗄️ Database Schema

### Tables Created

#### `pipeline_stages`
Stores stage definitions and analysis prompts
- `id`, `user_id`, `name`, `description`
- `color`, `position`, `analysis_prompt`
- `is_default`, `is_active`

#### `pipeline_settings`
User's global pipeline configuration
- `id`, `user_id`, `global_analysis_prompt`
- `auto_analyze`

#### `pipeline_opportunities`
Contacts in the pipeline
- `id`, `user_id`, `conversation_id`, `stage_id`
- `sender_id`, `sender_name`
- `ai_analysis_result` (JSONB)
- `ai_confidence_score`, `both_prompts_agreed`
- `manually_assigned`, `manually_assigned_at`, `manually_assigned_by`

#### `pipeline_stage_history`
Audit trail of stage movements
- `id`, `opportunity_id`, `from_stage_id`, `to_stage_id`
- `moved_by`, `moved_by_ai`, `reason`

---

## 🚀 Quick Start Guide

### 5-Minute Setup

1. **Run Database Migration**
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: add-pipeline-tables.sql
   ```

2. **Visit Pipeline Page**
   - Go to Dashboard → Sales Pipeline
   - Default "Unmatched" stage is auto-created ✨
   - See setup instructions on the page

3. **Configure Global Prompt**
   - Click "Pipeline Settings"
   - Add your analysis framework

4. **Create 3-4 Stages**
   - Click "Add Stage"
   - Name them based on your funnel
   - Write specific criteria for each

5. **Add Contacts**
   - Go to Conversations page
   - Select some contacts
   - Click "Add to Pipeline"

6. **Run Analysis**
   - Return to Pipeline page
   - Click "Analyze All Contacts"
   - Review results!

---

## 🎓 Tips & Tricks

### Getting Better AI Results

1. **Be Specific**: Vague prompts lead to inconsistent results
2. **Use Examples**: Include example phrases/keywords
3. **Define Timeframes**: "last 7 days" vs "last 30 days"
4. **Iterate**: Test and refine your prompts based on results
5. **Review Unmatched**: These reveal gaps in your stage definitions

### Managing Large Pipelines

- Create a "Cold" or "Inactive" stage for old leads
- Use the "Unmatched" stage as a daily review queue
- Regularly analyze new contacts (weekly schedule)
- Archive or remove truly dead leads

---

## ❓ FAQ

**Q: What happens if both prompts disagree?**
A: Contact goes to "Unmatched" stage for manual review. This is a safety feature to prevent incorrect categorization.

**Q: Can I edit prompts after creating stages?**
A: Yes! Click the settings icon on any stage card to edit its prompt and other properties.

**Q: Will re-analyzing move contacts that I've manually placed?**
A: No, manually assigned contacts keep their manual assignment. You'd need to remove the manual flag to re-analyze them.

**Q: How many contacts can the pipeline handle?**
A: No hard limit. AI analysis processes contacts in batches, so even 1000+ contacts work smoothly.

**Q: Can I delete stages?**
A: Yes, but you must first move all contacts out of that stage. Empty stages can be deleted.

**Q: What if I don't have OpenAI API key?**
A: The pipeline will work for manual management, but AI analysis requires OpenAI API key in your environment variables.

---

## 🔐 Security & Privacy

- All pipeline data is isolated per user (RLS policies)
- Conversation history sent to OpenAI for analysis
- No data is stored by OpenAI (per their API terms)
- Stage movements tracked in audit log

---

## 🎉 Success Stories

This system helps you:
- 📈 **Increase conversions** by engaging hot leads faster
- ⏰ **Save time** on manual lead qualification
- 🎯 **Focus efforts** on high-intent prospects
- 📊 **Track progress** through your sales funnel
- 🤖 **Scale** your contact management automatically

---

## 💡 Next Steps

1. Set up your first pipeline
2. Analyze your existing contacts
3. Refine prompts based on results
4. Integrate into your daily workflow
5. Watch your conversion rates improve!

**Need help?** Check the main README or reach out to support.

---

Made with ❤️ for better sales pipeline management

