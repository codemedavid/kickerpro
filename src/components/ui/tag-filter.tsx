'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag as TagIcon, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TagFilterProps {
  selectedTagIds: string[];
  onTagChange: (tagIds: string[]) => void;
  exceptTagIds?: string[];
  onExceptChange?: (tagIds: string[]) => void;
  className?: string;
}

export function TagFilter({ selectedTagIds, onTagChange, exceptTagIds = [], onExceptChange, className }: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user's tags
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      return data.tags || [];
    }
  });

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagChange([...selectedTagIds, tagId]);
    }
  };

  const clearAllTags = () => {
    onTagChange([]);
    if (onExceptChange) {
      onExceptChange([]);
    }
  };

  const toggleExceptTag = (tagId: string) => {
    if (!onExceptChange) return;
    
    if (exceptTagIds.includes(tagId)) {
      onExceptChange(exceptTagIds.filter(id => id !== tagId));
    } else {
      onExceptChange([...exceptTagIds, tagId]);
    }
  };

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
  const exceptTags = tags.filter(tag => exceptTagIds.includes(tag.id));

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9">
            <Filter className="w-4 h-4 mr-2" />
            Filter by Tags
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter by Tags</h4>
              {(selectedTagIds.length > 0 || exceptTagIds.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllTags}
                  className="h-8 px-2"
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Include Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map(tag => (
                    <Badge
                      key={tag.id}
                      className="flex items-center gap-1 px-2 py-1"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                      <button
                        onClick={() => toggleTag(tag.id)}
                        className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Except Tags */}
            {exceptTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Exclude Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {exceptTags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant="destructive"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {tag.name}
                      <button
                        onClick={() => toggleExceptTag(tag.id)}
                        className="ml-1 hover:bg-red-700 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Available Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Tags</Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {tags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    const isExcluded = exceptTagIds.includes(tag.id);
                    return (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent"
                      >
                        <div className="flex items-center space-x-2 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleTag(tag.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="w-3 h-3 rounded-full border cursor-pointer"
                            style={{ backgroundColor: tag.color }}
                            onClick={() => toggleTag(tag.id)}
                          />
                          <span 
                            className="text-sm cursor-pointer"
                            onClick={() => toggleTag(tag.id)}
                          >
                            {tag.name}
                          </span>
                        </div>
                        {onExceptChange && (
                          <div 
                            className="flex items-center space-x-1 cursor-pointer hover:bg-accent rounded p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExceptTag(tag.id);
                            }}
                          >
                            <span className="text-xs text-muted-foreground">Exclude:</span>
                            <Checkbox
                              checked={isExcluded}
                              onChange={() => toggleExceptTag(tag.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExceptTag(tag.id);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tags.length === 0 && !isLoading && (
              <div className="text-center py-4 text-muted-foreground">
                <TagIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tags available</p>
                <p className="text-xs">Create tags to filter conversations</p>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading tags...</p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
