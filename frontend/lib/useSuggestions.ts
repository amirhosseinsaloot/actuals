"use client";

import { useEffect, useState } from "react";

import { getAssistantSuggestions } from "./api";

/**
 * Loads the assistant's canned example questions from the backend once on mount.
 * Suggestions are a non-critical convenience, so any failure resolves to an
 * empty list rather than surfacing an error — the composer still works.
 */
export function useSuggestions(): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getAssistantSuggestions()
      .then(({ suggestions }) => active && setSuggestions(suggestions))
      .catch(() => active && setSuggestions([]));
    return () => {
      active = false;
    };
  }, []);

  return suggestions;
}
