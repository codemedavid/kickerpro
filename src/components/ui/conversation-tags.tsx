'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagSelector } from './tag-selector';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ConversationTagsProps {
  conversationId: string;
  className?: string;
}

export function ConversationTags({ conversationId, className }: ConversationTagsProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch conversation tags
  const { data: conversationTags = [], isLoading: tagsLoading } = useQuery<{
    id: string;
    tag: Tag;
  }[]>({
    queryKey: ['conversation-tags', conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/tags`);
      if (!response.ok) throw new Error('Failed to fetch conversation tags');
      const data = await response.json();
      return data.tags || [];
    }
  });

  // Update conversation tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      const response = await fetch(`/api/conversations/${conversationId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds })
      });
      if (!response.ok) throw new Error('Failed to update conversation tags');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-tags', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: "Tags Updated",
        description: "Conversation tags updated successfully"
      });
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tags",
        variant: "destructive"
      });
    }
  });

  const handleEditTags = () => {
    setSelectedTagIds(conversationTags.map(ct => ct.tag.id));
    setIsEditDialogOpen(true);
  };

  const handleSaveTags = () => {
    updateTagsMutation.mutate(selectedTagIds);
  };

  const removeTag = async (tagId: string) => {
    const newTagIds = conversationTags
      .filter(ct => ct.tag.id !== tagId)
      .map(ct => ct.tag.id);
    
    updateTagsMutation.mutate(newTagIds);
  };

  if (tagsLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="animate-pulse bg-muted rounded-full w-4 h-4"></div>
        <div className="animate-pulse bg-muted rounded w-16 h-4"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Display Tags */}
      <div className="flex items-center gap-1 flex-wrap">
        {conversationTags.map(({ tag }) => (
          <Badge
            key={tag.id}
            className="flex items-center gap-1 px-2 py-1 text-xs"
            style={{ backgroundColor: tag.color, color: 'white' }}
          >
            <TagIcon className="w-3 h-3" />
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-1 hover:bg-black/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        
        {/* Add Tag Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEditTags}
          className="h-6 px-2 text-xs hover:bg-accent"
        >
          <Plus className="w-3 h-3 mr-1" />
          {conversationTags.length === 0 ? 'Add Tag' : 'Edit'}
        </Button>
      </div>

      {/* Edit Tags Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags for this conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <TagSelector
              selectedTagIds={selectedTagIds}
              onTagChange={setSelectedTagIds}
              placeholder="Select tags for this conversation..."
            />
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTags}
                disabled={updateTagsMutation.isPending}
              >
                {updateTagsMutation.isPending ? 'Saving...' : 'Save Tags'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
