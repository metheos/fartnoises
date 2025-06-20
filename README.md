# Fartnoises Game 🎵💨

A hilarious sound-based party game for 3-8 players! Players take turns as judge, selecting weird prompts while others create funny sound combinations to match them.

## Game Overview

**Fartnoises** is a quirky multiplayer party game that combines:

- **Main Screen Interface** - Displayed on TV/shared display for all players to see
- **Player Device Controllers** - Phone/tablet/computer interfaces for individual interactions
- **Real-time Multiplayer** - Synchronized gameplay using Socket.IO

### How to Play

1. **Setup**: One device displays the main screen, players join on their phones/devices
2. **Join**: Players enter a 4-letter room code to join the game
3. **Judge Selection**: One player becomes judge per round
4. **Prompt Phase**: Judge selects from 3 weird prompts
5. **Sound Selection**: Other players choose 2 sound effects to match the prompt
6. **Playback**: All sound combos are played back anonymously
7. **Judging**: Judge picks the best/funniest combo
8. **Scoring**: Winner gets a point, repeat with new judge

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Modern web browser
- Multiple devices for multiplayer testing

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd fartnoises

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Running the Game

1. **Start the server**:

   ```bash
   npm run dev
   ```

2. **Open Main Screen** (TV/Display):

   - Navigate to `http://localhost:3001`
   - Click "Main Screen Mode"
   - This shows the shared game display

3. **Join as Players** (Phones/Devices):
   - Navigate to `http://localhost:3001` on each player device
   - Enter player name
   - Either "Create Room" (first player) or "Join Room" with 4-letter code

### Testing Multiplayer

To test locally:

1. Open the main screen in one browser window
2. Open multiple incognito/private windows as different players
3. Create a room with one player, join with others using the room code
4. Start playing!

## Technical Stack

- **Framework**: Next.js 15 with TypeScript and App Router
- **Styling**: Tailwind CSS for modern, colorful UI
- **Real-time Communication**: Socket.IO for multiplayer functionality
- **Audio**: Web Audio API for sound effects and playback

## Game Features

- ✅ Room creation with 4-letter codes
- ✅ Real-time multiplayer synchronization
- ✅ Judge rotation system
- ✅ Sound effect library (25+ sounds)
- ✅ Prompt database (25+ weird prompts)
- ✅ Responsive design for mobile and TV interfaces
- ✅ Player avatar system with colors
- ✅ Scoring and winner announcements

## Development

### Project Structure

```
src/
  app/              # Next.js App Router pages
    page.tsx        # Landing page
    game/           # Player device interface
    main-screen/    # TV display interface
  data/
    gameData.ts     # Sound effects and prompts
  types/
    game.ts         # TypeScript interfaces
  pages/api/
    socket.ts       # Socket.IO server
  utils/
    audioSystem.ts  # Audio playback utilities
```

### Adding Sound Effects

1. Add MP3 files to `public/sounds/`
2. Update the sound effects by modifying the EarwaxAudio.jet file or adding new .ogg files to `public/sounds/Earwax/EarwaxAudio/Audio/`
3. Follow the naming convention: `{category}_{name}.mp3`

### Customization

- **Prompts**: Edit `GAME_PROMPTS` in `src/data/gameData.ts`
- **Game Settings**: Modify `GAME_CONFIG` for rounds, timers, etc.
- **Colors**: Update `PLAYER_COLORS` for avatar colors
- **Sounds**: Add new sound effects to the library

## Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
npm run build
vercel deploy
```

### Other Platforms

The app can be deployed to any platform supporting Node.js:

- Netlify
- Railway
- Heroku
- Digital Ocean

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test multiplayer functionality
5. Submit a pull request

## License

MIT License - feel free to use this for your own party games!

## Credits

Created with ❤️ for hilarious party game nights!
