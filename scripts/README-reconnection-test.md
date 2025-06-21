# Reconnection System Test

This test script validates the reconnection system functionality for the fartnoises game.

## What it tests:

1. **Basic Connection** - Verifies that players can connect to the server
2. **Room Creation and Joining** - Tests room creation and player joining
3. **Game Start** - Ensures games can start properly
4. **Player Disconnection** - Verifies that disconnections pause the game
5. **Player Reconnection** - Tests successful reconnection to ongoing games
6. **Voting System** - Validates that players can vote on whether to continue
7. **Game Resumption** - Confirms games resume properly after voting

## How to run:

### Prerequisites:

1. Make sure the development server is running:

   ```bash
   npm run dev
   ```

2. Wait for the server to be ready on `http://localhost:3000`

### Run the test:

```bash
npm run test:reconnection
```

## Expected behavior:

The test script will:

- Create multiple test players
- Simulate a complete game flow with disconnections
- Test reconnection attempts
- Validate voting mechanisms
- Verify game state preservation

## Test output:

You'll see detailed logs showing:

- ✅ Successful test steps
- ❌ Failed test steps
- 🔍 Debug information
- 📊 Final test results summary

## Troubleshooting:

If tests fail:

1. Ensure the dev server is running and accessible
2. Check that no other tests are running simultaneously
3. Verify that the socket.io server is properly configured
4. Look at the detailed error messages in the test output

## Test duration:

The full test suite takes approximately 1-2 minutes to complete, as it includes:

- Grace periods for disconnection (30 seconds)
- Voting timeouts (20 seconds)
- Various waiting periods for state changes

## Manual testing:

You can also manually test the reconnection system by:

1. Starting a game with multiple players
2. Closing a browser tab mid-game
3. Observing the pause and voting behavior
4. Attempting to reconnect by navigating back to the game
