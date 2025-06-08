# Testing Guide for Fartnoises Game 🎮

## Quick Multiplayer Test

### Setup

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```
2. **Open Main Screen** (TV/Display):
   - Navigate to: `http://localhost:3001/main-screen`
   - This will show the shared game display

### Testing with Multiple Players

#### Option 1: Multiple Browser Windows (Same Computer)

1. **Player 1 (Host)**:

   - Open `http://localhost:3001` in a new browser window
   - Enter your name (e.g., "Alice")
   - Click "Create Room"
   - Note the 4-letter room code

2. **Player 2**:

   - Open `http://localhost:3001` in an incognito/private window
   - Enter your name (e.g., "Bob")
   - Click "Join Room"
   - Enter the room code from Player 1

3. **Player 3** (Optional):
   - Open `http://localhost:3001` in another browser
   - Enter your name (e.g., "Charlie")
   - Join with the same room code

#### Option 2: Multiple Devices (Recommended)

1. Find your computer's local IP address:
   ```bash
   ipconfig  # On Windows
   ```
2. Use the IP address instead of localhost:
   - Main Screen: `http://[YOUR_IP]:3001/main-screen`
   - Players: `http://[YOUR_IP]:3001`

### Game Flow Test

1. **Lobby Phase**:

   - ✅ Check that all players appear on main screen
   - ✅ Host can see "Start Game" button when 3+ players
   - ✅ Players see their colored avatars

2. **Game Start**:

   - ✅ Host clicks "Start Game"
   - ✅ First player becomes judge (crown icon)
   - ✅ Main screen shows game state

3. **Prompt Selection**:

   - ✅ Judge sees 3 prompt options
   - ✅ Other players see "Judge is selecting..."
   - ✅ Judge picks a prompt

4. **Sound Selection**:

   - ✅ Non-judges see sound grid
   - ✅ Players can preview sounds (with beep placeholders)
   - ✅ Players select 2 sounds
   - ✅ Timer counts down
   - ✅ Submit button appears when 2 sounds selected

5. **Judging Phase**:

   - ✅ Judge sees all submissions
   - ✅ Can play sound combinations
   - ✅ Selects winner

6. **Results & Next Round**:
   - ✅ Scores update
   - ✅ New judge is selected
   - ✅ Game continues

### Audio Testing

#### Sound Preview:

- Click "Preview" buttons in sound selection
- Should hear beep sounds (placeholders)
- Visual feedback shows "Playing..."

#### Sound Playback (Judge):

- Click "Play" on submissions during judging
- Should play selected sounds in sequence
- Loading indicator while playing

### Troubleshooting

#### Connection Issues:

- Check browser console for Socket.IO errors
- Refresh page and rejoin if disconnected
- Ensure development server is running

#### Audio Issues:

- Click anywhere on page to enable audio context
- Check browser audio permissions
- Empty MP3 files will generate beep placeholders

#### UI Issues:

- Test on mobile devices for responsive design
- Check that all buttons are clickable
- Verify timer updates in real-time

### Performance Test

#### Stress Test:

1. Open 6-8 player windows
2. Create room and join all players
3. Start game and play several rounds
4. Monitor for memory leaks or lag

#### Network Test:

1. Use multiple devices on same network
2. Test with slower connections
3. Check reconnection after network interruption

### Known Limitations

- **Audio Files**: Currently using placeholder beeps
- **Persistence**: Game state lost on server restart
- **Scale**: Single server instance only
- **Mobile**: May need touch optimizations

### Next Steps

1. **Add Real Audio**: Replace placeholder MP3s with actual sounds
2. **Improve Mobile UX**: Test and optimize for touch devices
3. **Add Persistence**: Implement Redis or database storage
4. **Deploy**: Test on production environment
5. **Polish**: Add animations, better error handling

---

## Quick Commands

```bash
# Start development server
npm run dev

# Check for TypeScript errors
npm run type-check

# Build for production
npm run build

# Start production server
npm start
```

Have fun testing! 🎉
