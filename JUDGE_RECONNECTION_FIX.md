# Judge Reconnection Fix

## Problem
When a judge disconnects during a game, the system would immediately reassign the judge role to another player, even when other players voted to "wait longer" for the disconnected judge to reconnect. This meant that if the original judge reconnected, they would no longer be the judge.

## Root Cause
The issue was in the `resumeGame` function in `reconnectionHandlers.ts`. This function was automatically reassigning the judge role whenever:
1. A judge was disconnected (not in active players list)
2. The game resumed (after voting or after all players reconnected)

The logic didn't distinguish between:
- **Players voting to "continue without" the disconnected judge** (should reassign judge)
- **Players voting to "wait longer"** (should preserve judge role for reconnection)
- **Judge successfully reconnecting** (should restore their judge role)

## Solution
### Changes Made

1. **Modified `handleReconnectionVoteResult` function:**
   - Added logic to detect if the disconnected player was the judge
   - Pass this information to `resumeGame` function
   - Only reassign judge when players vote to "continue without" the judge

2. **Enhanced `resumeGame` function:**
   - Added optional `shouldReassignJudge` parameter (defaults to false)
   - Only reassigns judge when explicitly requested
   - Added logging to distinguish between judge reassignment vs. preservation
   - Preserves judge role when waiting for disconnected judge to return

3. **Updated reconnection logic:**
   - When a judge successfully reconnects, their role is automatically restored
   - Game resumes without reassigning judge when all players reconnect

### Code Changes

**File:** `src/server/handlers/reconnectionHandlers.ts`

#### Function Signature Change:
```typescript
// Before
function resumeGame(context: SocketContext, roomCode: string, previousGameState: GameState)

// After  
function resumeGame(context: SocketContext, roomCode: string, previousGameState: GameState, shouldReassignJudge: boolean = false)
```

#### Vote Result Handling:
```typescript
// Before: Always removed player and resumed game
if (continueWithoutPlayer) {
  room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.name !== disconnectedPlayerName);
  resumeGame(context, roomCode, previousGameState);
}

// After: Check if player was judge and pass that info
if (continueWithoutPlayer) {
  const disconnectedPlayer = room.disconnectedPlayers?.find(p => p.name === disconnectedPlayerName);
  const wasJudge = disconnectedPlayer && room.currentJudge === disconnectedPlayer.socketId;
  
  room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.name !== disconnectedPlayerName);
  resumeGame(context, roomCode, previousGameState, wasJudge);
}
```

#### Judge Role Logic:
```typescript
// Before: Always reassigned judge if not in active players
if (room.currentJudge && !room.players.find((p) => p.id === room.currentJudge)) {
  room.currentJudge = selectNextJudge(room);
  context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
}

// After: Only reassign when explicitly requested
if (shouldReassignJudge && room.currentJudge && !room.players.find((p) => p.id === room.currentJudge)) {
  console.log(`Reassigning judge role because players voted to continue without the disconnected judge`);
  room.currentJudge = selectNextJudge(room);
  context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
} else if (room.currentJudge && !room.players.find((p) => p.id === room.currentJudge)) {
  console.log(`Preserving judge role for disconnected judge: ${room.currentJudge}`);
}
```

## Testing
Created `scripts/test-judge-reconnection.ts` to specifically test this scenario:
1. Sets up a game with 3 players
2. Identifies the judge
3. Disconnects the judge
4. Simulates other players voting to "wait longer"
5. Reconnects the judge
6. Verifies the judge role is preserved

**Run test:** `npm run test:judge-reconnection`

## Behavior Now
- ✅ **Judge disconnects, players vote "wait longer":** Judge role preserved for reconnection
- ✅ **Judge disconnects, players vote "continue without":** Judge role reassigned to another player  
- ✅ **Judge reconnects after "wait" vote:** Judge role restored automatically
- ✅ **Non-judge player disconnects:** No impact on judge role assignment

## Impact
This fix ensures a better user experience where:
- Players can choose to wait for an important role (judge) to return
- The original judge doesn't lose their role if they briefly disconnect and reconnect
- Game flow is preserved when players decide to wait for disconnected players
- Judge rotation only happens when players explicitly choose to continue without the disconnected judge
