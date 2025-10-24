# 📎 Media Support for Facebook Bulk Messenger

This document explains how to send media attachments (images, videos, audio, files) through your Facebook Bulk Messenger system.

## 🎯 **Overview**

Your system now supports sending various types of media attachments via Facebook Messenger API:

- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, MOV, AVI, WebM
- **Audio**: MP3, WAV, M4A, AAC
- **Files**: PDF, DOC, DOCX, TXT, and more

## 🏗️ **Architecture Changes**

### **1. Database Schema Updates**

Run the SQL script to add media support to your database:

```sql
-- Add media_attachments column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_attachments JSONB;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_media_attachments ON messages USING GIN (media_attachments);
```

### **2. Enhanced API Endpoints**

- **`/api/messages/[id]/send-enhanced`** - New endpoint for media support
- **`/dashboard/compose-media`** - New compose page with media upload

### **3. Media Attachment Structure**

```typescript
interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  is_reusable?: boolean;
  filename?: string;
  size?: number;
}
```

## 🚀 **How to Use Media Support**

### **1. Database Setup**

1. Run the database migration script:
```bash
# In Supabase SQL Editor
-- Copy and paste the contents of database-media-support.sql
```

### **2. Frontend Integration**

Navigate to the new media compose page:
```
/dashboard/compose-media
```

### **3. API Usage**

#### **Creating Messages with Media**

```typescript
const messageData = {
  title: "Product Launch",
  content: "Check out our new product!",
  page_id: "page-uuid",
  created_by: "user-uuid",
  recipient_type: "all",
  recipient_count: 1000,
  status: "sent",
  media_attachments: [
    {
      type: "image",
      url: "https://example.com/product.jpg",
      is_reusable: true,
      filename: "product-image.jpg",
      size: 1024000
    }
  ]
};

// POST to /api/messages
const response = await fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(messageData)
});
```

#### **Sending Messages with Media**

```typescript
// POST to /api/messages/{id}/send-enhanced
const response = await fetch(`/api/messages/${messageId}/send-enhanced`, {
  method: 'POST'
});
```

## 📋 **Facebook API Requirements**

### **Supported Media Types**

| Type | Extensions | Max Size | Notes |
|------|------------|----------|-------|
| Image | JPG, PNG, GIF, WebP | 25MB | Recommended: 800x600px |
| Video | MP4, MOV, AVI, WebM | 25MB | Recommended: 720p |
| Audio | MP3, WAV, M4A, AAC | 25MB | Recommended: 128kbps |
| File | PDF, DOC, DOCX, TXT | 25MB | Any file type |

### **URL Requirements**

- ✅ Must be HTTPS
- ✅ Must be publicly accessible
- ✅ Must return proper Content-Type headers
- ✅ Must be accessible without authentication

### **Facebook API Format**

```json
{
  "recipient": { "id": "RECIPIENT_ID" },
  "message": {
    "attachment": {
      "type": "image",
      "payload": {
        "url": "https://example.com/image.jpg",
        "is_reusable": true
      }
    }
  }
}
```

## 🔧 **Implementation Details**

### **1. Enhanced Send Function**

The new `sendFacebookMessageWithMedia` function handles:

- **Media Detection**: Automatically detects attachment type
- **Text + Media**: Sends text first, then media
- **Error Handling**: Specific error messages for media issues
- **Rate Limiting**: Increased delays for media messages (200ms)

### **2. Batch Processing**

Media messages use smaller batches (50 vs 100) due to:
- Larger payload sizes
- Increased processing time
- Facebook API rate limits

### **3. Personalization Support**

Media attachments work with personalization:
- Text content is personalized first
- Media is sent as a separate message
- Maintains recipient-specific customization

## 🧪 **Testing Media Support**

### **1. Test Script**

Run the media test script:

```bash
node test-media-send.js <ACCESS_TOKEN> <RECIPIENT_ID>
```

This will test:
- Image sending
- Video sending
- Audio sending
- File sending
- Combined text + media

### **2. Manual Testing**

1. Go to `/dashboard/compose-media`
2. Upload media files
3. Compose your message
4. Send to test recipients
5. Check delivery status

## ⚠️ **Important Considerations**

### **1. File Size Limits**

- **Facebook Limit**: 25MB per attachment
- **Recommended**: < 10MB for better performance
- **Mobile Users**: Consider data usage

### **2. URL Accessibility**

- Media URLs must be publicly accessible
- No authentication required
- HTTPS only
- Proper Content-Type headers

### **3. Performance Impact**

- Media messages take longer to send
- Increased bandwidth usage
- Larger database storage requirements
- Slower batch processing

### **4. Error Handling**

Common media errors:
- **Invalid URL**: Check URL accessibility
- **Unsupported Format**: Verify file type
- **Size Exceeded**: Compress files
- **Network Issues**: Retry mechanism

## 🎨 **UI Features**

### **1. Media Upload Interface**

- Drag & drop file upload
- Multiple file selection
- File type validation
- Size limit checking
- Preview thumbnails

### **2. Media Management**

- Remove individual attachments
- View file details (size, type)
- Batch operations
- Progress indicators

### **3. Preview System**

- Message preview with media
- Attachment indicators
- File type icons
- Size information

## 🔄 **Migration from Text-Only**

### **1. Existing Messages**

- Text-only messages continue to work
- No breaking changes to existing functionality
- Gradual migration to media support

### **2. Database Compatibility**

- New `media_attachments` column is optional
- Existing messages remain unchanged
- Backward compatibility maintained

### **3. API Compatibility**

- Original `/api/messages/[id]/send` still works
- New `/api/messages/[id]/send-enhanced` for media
- Both endpoints can coexist

## 📊 **Monitoring & Analytics**

### **1. Media Statistics**

```sql
-- Get media usage statistics
SELECT * FROM get_media_stats();
```

### **2. Performance Metrics**

- Send success rates by media type
- Average processing time
- Error rates by attachment type
- Bandwidth usage

### **3. Database Views**

```sql
-- View messages with media information
SELECT * FROM messages_with_media;
```

## 🚀 **Future Enhancements**

### **1. Planned Features**

- **Cloud Storage Integration**: Direct upload to S3/Cloudinary
- **Media Compression**: Automatic image/video optimization
- **Batch Media Processing**: Multiple attachments per message
- **Media Templates**: Reusable media templates

### **2. Advanced Features**

- **Media Analytics**: Open rates, click-through rates
- **A/B Testing**: Different media versions
- **Scheduled Media**: Time-based media delivery
- **Media Personalization**: Dynamic media based on user data

## 📚 **Resources**

### **1. Facebook Documentation**

- [Messenger Platform - Attachments](https://developers.facebook.com/docs/messenger-platform/send-messages/message-types)
- [Media Upload API](https://developers.facebook.com/docs/messenger-platform/send-messages/upload-api)
- [Attachment Types](https://developers.facebook.com/docs/messenger-platform/send-messages/message-types#attachment)

### **2. Testing Tools**

- `test-media-send.js` - Media sending tests
- `test-send-simple.js` - Basic API tests
- Browser DevTools - Network monitoring

### **3. Troubleshooting**

- Check Facebook API status
- Verify access token permissions
- Test with small files first
- Monitor network requests
- Check error logs

---

## 🎯 **Quick Start Checklist**

- [ ] Run database migration script
- [ ] Test media upload functionality
- [ ] Verify Facebook API permissions
- [ ] Test with small media files
- [ ] Monitor performance metrics
- [ ] Set up error monitoring
- [ ] Train users on new features

Your Facebook Bulk Messenger now supports rich media content! 🎉
