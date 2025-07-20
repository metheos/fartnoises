"use client";

import React from "react";
import { clearAllCaches, clearSoundCache, clearPromptCache } from "@/utils/soundLoader";

interface CacheControlDebuggerProps {
  className?: string;
}

export function CacheControlDebugger({ className = "" }: CacheControlDebuggerProps) {
  const handleClearSoundCache = () => {
    clearSoundCache();
    alert("Sound cache cleared! Refresh page to reload sounds.");
  };

  const handleClearPromptCache = () => {
    clearPromptCache();
    alert("Prompt cache cleared! Refresh page to reload prompts.");
  };

  const handleClearAllCaches = () => {
    clearAllCaches();
    alert("All caches cleared! Refresh page to reload all content.");
  };

  const handleForceReload = () => {
    // Force a hard reload to clear browser cache
    window.location.reload();
  };

  return (
    <div className={`bg-yellow-100 border border-yellow-400 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-bold text-yellow-800 mb-3">🔧 Cache Control Debugger</h3>
      <p className="text-sm text-yellow-700 mb-4">
        Use these tools to clear cached content when EarwaxAudio.jet or EarwaxPrompts.jet files are updated.
      </p>
      
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleClearSoundCache}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Clear Sound Cache
        </button>
        
        <button
          onClick={handleClearPromptCache}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Clear Prompt Cache
        </button>
        
        <button
          onClick={handleClearAllCaches}
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Clear All Caches
        </button>
        
        <button
          onClick={handleForceReload}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Force Reload Page
        </button>
      </div>
      
      <div className="mt-3 text-xs text-yellow-600">
        <p><strong>Note:</strong> Cache busting is now automatically applied to .jet files.</p>
        <p>If issues persist, use &quot;Force Reload Page&quot; to clear browser cache.</p>
      </div>
    </div>
  );
}
