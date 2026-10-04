"use client";

import React, { useState, useId, useMemo, useCallback, useEffect } from "react";

export function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export interface PaginationBarProps {
  from: number;
  to: number;
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  itemName?: string;
  pageSizeOptions?: number[];
  onPageClick: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  jumpPage?: string;
  onJumpChange?: (val: string) => void;
  onJumpSubmit?: (e: React.FormEvent) => void;
}

export function PaginationBar({
  from,
  to,
  total,
  currentPage,
  totalPages,
  pageSize,
  itemName = "records",
  pageSizeOptions = [10, 20, 50, 100],
  onPageClick,
  onPageSizeChange,
  jumpPage: controlledJumpPage,
  onJumpChange: controlledOnJumpChange,
  onJumpSubmit: controlledOnJumpSubmit,
}: PaginationBarProps) {
  const selectId = useId();
  const jumpId = useId();

  // Internal jump state if not controlled externally
  const [internalJump, setInternalJump] = useState("");
  const isJumpControlled = controlledJumpPage !== undefined;
  const jumpVal = isJumpControlled ? controlledJumpPage : internalJump;

  const handleJumpChange = (val: string) => {
    if (isJumpControlled && controlledOnJumpChange) {
      controlledOnJumpChange(val);
    } else {
      setInternalJump(val);
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isJumpControlled && controlledOnJumpSubmit) {
      controlledOnJumpSubmit(e);
    } else {
      const target = parseInt(internalJump.trim(), 10);
      if (!isNaN(target) && target >= 1 && target <= totalPages) {
        if (target !== currentPage) {
          onPageClick(target);
        }
        setInternalJump("");
      }
    }
  };

  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="pagination-bar">
      <div>
        {total === 0 ? (
          <>
            Showing <strong>0</strong> of <strong>0</strong> {itemName}
          </>
        ) : (
          <>
            Showing <strong>{from.toLocaleString()}</strong>–<strong>{to.toLocaleString()}</strong>{" "}
            of <strong>{total.toLocaleString()}</strong> {itemName}
          </>
        )}
      </div>

      <div className="pagination-controls">
        {/* Page Size Selector */}
        <div className="pagination-pagesize">
          <label htmlFor={selectId}>Rows:</label>
          <select
            id={selectId}
            className="pagination-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Page Nav Buttons */}
        <div className="pagination-nav" role="navigation" aria-label="Pagination Navigation">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(1)}
            disabled={currentPage <= 1}
            title="First page"
            aria-label="First page"
          >
            «
          </button>

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            ‹
          </button>

          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  &hellip;
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                className={`pagination-btn ${isActive ? "active" : ""}`}
                onClick={() => onPageClick(pageNum)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Page ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
            aria-label="Next page"
          >
            ›
          </button>

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last page"
            aria-label="Last page"
          >
            »
          </button>
        </div>

        {/* Jump To Page */}
        {totalPages > 5 && (
          <form onSubmit={handleJumpSubmit} className="pagination-jump">
            <label htmlFor={jumpId}>Go to:</label>
            <input
              id={jumpId}
              type="number"
              min={1}
              max={totalPages}
              value={jumpVal}
              onChange={(e) => handleJumpChange(e.target.value)}
              placeholder={String(currentPage)}
              className="pagination-jump-input"
              aria-label={`Go to page between 1 and ${totalPages}`}
            />
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Universal client-side pagination hook.
 * Automatically slices any item array and maintains pagination state.
 */
export function useClientPagination<T>(
  items: T[],
  initialPageSize = 20,
  resetDeps: unknown[] = [],
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset to page 1 whenever resetDeps change
  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  // Clamp current page if total changes and current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  const paginatedItems = useMemo(() => {
    if (total === 0) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, currentPage, pageSize, total]);

  const onPageClick = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  const onPageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from,
    to,
    paginatedItems,
    onPageClick,
    onPageSizeChange,
  };
}
