# 🚫 Except Filter Feature

## Overview
The Except Filter feature allows you to exclude conversations with specific tags from your view. This is useful for filtering out conversations you don't want to see while browsing.

## Features

### ✅ **Include Tags** (Show Only)
- Select tags to show **only** conversations with those tags
- Multiple tags can be selected (OR logic)
- Conversations must have at least one of the selected tags

### ❌ **Exclude Tags** (Hide)
- Select tags to **hide** conversations with those tags
- Multiple tags can be selected (OR logic)
- Conversations with any of the excluded tags will be hidden

### 🔄 **Combined Filtering**
- Use both include and exclude filters together
- Include filters are applied first, then exclude filters
- Example: Show "VIP" tagged conversations, but exclude "Blocked" tagged ones

## How to Use

### 1. **Access Tag Filter**
- Go to Conversations page
- Click "Filter by Tags" button

### 2. **Include Tags** (Show specific tags)
- Check the box next to any tag name
- Selected tags appear in the "Include Tags" section at the top
- Click the X to remove a tag from the filter

### 3. **Exclude Tags** (Hide specific tags)
- Check the "Exclude" checkbox on the right side of any tag
- Excluded tags appear in red in the "Exclude Tags" section
- Click the X to remove a tag from exclusion

### 4. **Clear All Filters**
- Click "Clear All" button to remove all filters at once

## UI Elements

### **Include Tags Display**
- Blue badges with tag color
- Shows selected include tags
- Click X to remove

### **Exclude Tags Display**
- Red destructive badges
- Shows selected exclude tags
- Click X to remove

### **Available Tags List**
Each tag row shows:
- **Left**: Checkbox for include filter
- **Center**: Tag name and color indicator
- **Right**: "Exclude" checkbox for except filter

## Examples

### Example 1: Show Only VIP Customers
- ✅ Check "VIP" tag
- Result: Only conversations tagged as "VIP" will show

### Example 2: Hide Spam Conversations
- ❌ Check "Exclude" for "Spam" tag
- Result: All conversations except those tagged as "Spam" will show

### Example 3: Show Important but Hide Resolved
- ✅ Check "Important" tag
- ❌ Check "Exclude" for "Resolved" tag
- Result: Only "Important" conversations that are NOT "Resolved" will show

## Technical Details

### API Parameter
- **`exceptTagIds`**: Comma-separated list of tag IDs to exclude
- Example: `?exceptTagIds=uuid1,uuid2,uuid3`

### Backend Logic
1. Fetch conversations with include tags (if any)
2. Fetch conversations with exclude tags
3. Remove excluded conversations from results
4. Apply other filters (page, date, search)
5. Return filtered results

### Performance
- Server-side filtering for efficiency
- Optimized queries with proper indexing
- Minimal performance impact

## Benefits

1. **Better Organization**: Quickly filter out unwanted conversations
2. **Flexible Filtering**: Combine include and exclude filters for precise results
3. **Time Saving**: No need to manually skip over tagged conversations
4. **Clean UI**: Keep your conversation list focused on what matters

## Tips

- Use exclude filters to hide completed/resolved conversations
- Combine with date filters for targeted views
- Create tags like "Archive", "Blocked", "Spam" for easy exclusion
- Use include + exclude together for precise filtering

