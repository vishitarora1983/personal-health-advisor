'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { GroceryItem } from '@/types';

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggle: (itemId: number, checked: boolean) => void;
}

/**
 * Single grocery list item with checkbox.
 */
export function GroceryItemRow({ item, onToggle }: GroceryItemRowProps) {
  return (
    <label className="flex items-center space-x-3 py-2 cursor-pointer group hover:bg-gray-50 px-2 rounded">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
      />
      <div className="flex-1">
        <span
          className={cn(
            'text-sm',
            item.checked ? 'line-through text-gray-400' : 'text-gray-900'
          )}
        >
          {item.ingredient_name}
        </span>
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          item.checked ? 'text-gray-400' : 'text-gray-700'
        )}
      >
        {item.quantity !== null ? `${item.quantity} ${item.unit}` : item.unit}
      </span>
    </label>
  );
}
