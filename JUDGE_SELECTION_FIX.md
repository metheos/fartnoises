# Judge Selection Reconnection Fix

## Problem Identified

When a player reconnected during the judge selection phase, the game would get stuck and not auto-transition to the next phase (prompt selection). This was caused by multiple timers being started during reconnection, creating race conditions.

## Root Cause

The original reconnection logic in `resumeGame()` would always start a new 3-second setTimeout for the judge selection → prompt selection transition, even if one was already running. This is different from the sound selection phase, which has a `soundSelectionTimerStarted` flag to prevent duplicate timers.

## Solution Implemented

### 1. Added New Timer Tracking Flag

- Added `judgeSelectionTimerStarted?: boolean` to the `Room` interface in `types/game.ts`
- Initialize to `false` when rooms are created

### 2. Updated Original Game Start Logic

- Set `room.judgeSelectionTimerStarted = true` before starting the setTimeout
- Reset `room.judgeSelectionTimerStarted = false` when the timer completes and transitions to prompt selection

### 3. Updated Round Start Logic

- Initialize `room.judgeSelectionTimerStarted = false` at the start of each new round
- Set to `true` before starting the timer, reset to `false` when complete

### 4. Fixed Reconnection Logic

- Modified `resumeGame()` to only start the judge selection timer if `!room.judgeSelectionTimerStarted`
- This prevents duplicate timers and matches the pattern used for sound selection

## Code Changes

### `src/types/game.ts`

```typescript
export interface Room {
  // ... existing properties ...
  soundSelectionTimerStarted?: boolean;
  judgeSelectionTimerStarted?: boolean; // NEW
  isPlayingBack?: boolean;
  // ... rest of properties ...
}
```

### `src/pages/api/socket.ts`

1. **Room Creation**: Initialize `judgeSelectionTimerStarted: false`
2. **Game Start**: Set flag to `true` before timer, `false` when complete
3. **New Round**: Reset flag to `false`, set to `true` before timer
4. **Reconnection**: Only start timer if `!room.judgeSelectionTimerStarted`

## Testing

- Created test script to verify the logic flow
- Confirmed that reconnection will only restart timer when appropriate
- Prevents race conditions and duplicate timers

## Result

Players can now reconnect during the judge selection phase without the game getting stuck. The auto-transition to prompt selection will work correctly whether reconnection happens before or after the original timer was started.

## Pattern Consistency

This fix makes the judge selection timer logic consistent with the existing sound selection timer pattern, improving maintainability and reducing bugs.
