'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Tag as TagIcon, 
  Plus, 
  Pencil, 
  Trash2, 
  AlertTriangle,
  Loader2,
  Save,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

const PREDEFINED_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' },
];

export default function TagsManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#3B82F6');

  // Fetch tags with usage count
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      return data.tags || [];
    }
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; color: string }) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast({
        title: "Tag Created",
        description: `Tag "${data.tag.name}" created successfully`
      });
      setNewTagName('');
      setNewTagColor('#3B82F6');
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create tag",
        variant: "destructive"
      });
    }
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tag');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: "Tag Updated",
        description: `Tag "${data.tag.name}" updated successfully`
      });
      setIsEditDialogOpen(false);
      setSelectedTag(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tag",
        variant: "destructive"
      });
    }
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tag');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: "Tag Deleted",
        description: `Tag "${selectedTag?.name}" has been permanently deleted`,
        variant: "default"
      });
      setIsDeleteDialogOpen(false);
      setSelectedTag(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete tag",
        variant: "destructive"
      });
    }
  });

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast({
        title: "Error",
        description: "Tag name is required",
        variant: "destructive"
      });
      return;
    }

    createTagMutation.mutate({
      name: newTagName.trim(),
      color: newTagColor
    });
  };

  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTag = () => {
    if (!selectedTag) return;

    if (!editTagName.trim()) {
      toast({
        title: "Error",
        description: "Tag name is required",
        variant: "destructive"
      });
      return;
    }

    updateTagMutation.mutate({
      id: selectedTag.id,
      name: editTagName.trim(),
      color: editTagColor
    });
  };

  const handleDeleteTag = (tag: Tag) => {
    setSelectedTag(tag);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteTag = () => {
    if (!selectedTag) return;
    deleteTagMutation.mutate(selectedTag.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tags Management</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage your conversation tags
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 w-4 h-4" />
          Create Tag
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Tags</p>
              <p className="text-3xl font-bold mt-2">{tags.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <TagIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tags</CardTitle>
          <CardDescription>
            Manage your tags and see how many conversations use each one
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No tags yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first tag to start organizing your conversations
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 w-4 h-4" />
                Create Your First Tag
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  {/* Tag Badge */}
                  <Badge
                    className="px-4 py-2 text-base font-medium"
                    style={{ backgroundColor: tag.color, color: 'white' }}
                  >
                    <TagIcon className="w-4 h-4 mr-2" />
                    {tag.name}
                  </Badge>

                  {/* Tag Info */}
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(tag.created_at).toLocaleDateString()}
                    </p>
                    {tag.usage_count !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Used in {tag.usage_count} conversation{tag.usage_count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTag(tag)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTag(tag)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <TagIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">About Tags</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Tags help you organize and filter your conversations</p>
                <p>• Each tag can have a custom name and color</p>
                <p>• Deleting a tag will remove it from all conversations</p>
                <p>• You can bulk add/remove tags from the Conversations page</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to organize your conversations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-tag-name">Tag Name</Label>
              <Input
                id="create-tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name..."
                className="mt-1"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="create-tag-color">Tag Color</Label>
              <Select value={newTagColor} onValueChange={setNewTagColor}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_COLORS.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Preview */}
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Preview:</Label>
                <Badge
                  className="mt-2 px-3 py-1"
                  style={{ backgroundColor: newTagColor, color: 'white' }}
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {newTagName || 'Tag Name'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewTagName('');
                setNewTagColor('#3B82F6');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTag}
              disabled={createTagMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTagMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 w-4 h-4" />
                  Create Tag
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name and color
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input
                id="edit-tag-name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="Enter tag name..."
                className="mt-1"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="edit-tag-color">Tag Color</Label>
              <Select value={editTagColor} onValueChange={setEditTagColor}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_COLORS.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Preview */}
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Preview:</Label>
                <Badge
                  className="mt-2 px-3 py-1"
                  style={{ backgroundColor: editTagColor, color: 'white' }}
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {editTagName || 'Tag Name'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedTag(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTag}
              disabled={updateTagMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateTagMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Tag Permanently?
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Are you sure you want to permanently delete the tag{' '}
                {selectedTag && (
                  <Badge
                    className="inline-flex mx-1"
                    style={{ backgroundColor: selectedTag.color, color: 'white' }}
                  >
                    {selectedTag.name}
                  </Badge>
                )}
                ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-red-900 mb-1">⚠️ Warning:</p>
                <ul className="text-red-800 space-y-1 list-disc list-inside">
                  <li>This action cannot be undone</li>
                  <li>The tag will be removed from all conversations</li>
                  {selectedTag?.usage_count !== undefined && selectedTag.usage_count > 0 && (
                    <li className="font-semibold">
                      This tag is currently used in {selectedTag.usage_count} conversation{selectedTag.usage_count !== 1 ? 's' : ''}
                    </li>
                  )}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedTag(null);
              }}
            >
              <X className="mr-2 w-4 h-4" />
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteTag}
              disabled={deleteTagMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteTagMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 w-4 h-4" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

