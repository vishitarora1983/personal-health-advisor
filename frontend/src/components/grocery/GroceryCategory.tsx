'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { GroceryItemRow } from './GroceryItemRow';
import type { GroceryItem } from '@/types';

interface GroceryCategoryProps {
  category: string;
  items: GroceryItem[];
  onToggleItem: (itemId: number, checked: boolean) => void;
}

/**
 * Collapsible category section for grocery items.
 */
export function GroceryCategory({ category, items, onToggleItem }: GroceryCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;

  return (
    <Card padding="md">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">{category}</h3>
          <span className="text-sm text-gray-600">
            {checkedCount} / {totalCount}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Items List */}
      {isExpanded && (
        <div className="mt-4 space-y-1">
          {items.map((item) => (
            <GroceryItemRow key={item.id} item={item} onToggle={onToggleItem} />
          ))}
        </div>
      )}
    </Card>
  );
}
