import { useState, useCallback, useMemo } from 'react';

export function useEmailSelection(allIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const removeIds = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;
  const isAllSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < allIds.length;
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    removeIds,
  };
}
