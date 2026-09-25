"use client";

import React, { useState } from "react";
import { IconRotateCcw } from "./icons";

export interface ErrorActionsProps {
  onRetry?: () => void;
  onGoBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  fallbackHref?: string;
}

export function ErrorActions({
  onRetry,
  onGoBack,
  retryLabel = "Retry",
  backLabel = "Go Back",
  fallbackHref = "/dashboard",
}: ErrorActionsProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  function handleGoBack() {
    if (onGoBack) {
      onGoBack();
      return;
    }
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = fallbackHref;
      }
    }
  }

  function handleRetry() {
    if (isRetrying) return;
    setIsRetrying(true);
    if (onRetry) {
      try {
        onRetry();
      } catch {
        // Continue to reload fallback
      }
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 500);
    } else {
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 400);
    }
  }

  return (
    <div className="error-actions-group">
      {/* GO BACK BUTTON (on the left) */}
      <button
        type="button"
        className="error-btn-back"
        onClick={handleGoBack}
        aria-label={backLabel}
      >
        <span className="back-arrow-wrap" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "15px", height: "15px" }}
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </span>
        <span className="back-btn-text">{backLabel}</span>
      </button>

      {/* RETRY BUTTON (on the right) */}
      <button
        type="button"
        className="error-btn-retry"
        onClick={handleRetry}
        disabled={isRetrying}
        aria-label={retryLabel}
      >
        <IconRotateCcw
          className={`error-reload-icon ${isRetrying ? "is-spinning" : ""}`}
        />
        <span>{isRetrying ? "Reloading..." : retryLabel}</span>
      </button>
    </div>
  );
}
