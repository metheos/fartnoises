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
4. **Prompt Phase**: Judge selects from a set of weird prompts
5. **Sound Selection**: Other players choose 1-3 sound effects to match the prompt
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

### Audio Content Setup

**Important**: The Earwax audio files are not included in this repository due to copyright. You'll need to copy them from your Jackbox Party Pack 2 installation.

1. **Locate your Jackbox Party Pack 2 installation**:

   - Default Steam location: `C:\Program Files (x86)\Steam\steamapps\common\The Jackbox Party Pack 2\games\Earwax\content`
   - Or find your Steam library folder, then navigate to: `steamapps\common\The Jackbox Party Pack 2\games\Earwax\content`

2. **Copy the audio files**:

   ```powershell
   # Navigate to your project directory
   cd fartnoises

   # Copy Earwax audio content (adjust path to your Steam installation)
   Copy-Item "H:\SteamLibrary\steamapps\common\The Jackbox Party Pack 2\games\Earwax\content\*" .\public\sounds\Earwax\ -Recurse

   # Alternative: if your Steam is in the default location
   Copy-Item "C:\Program Files (x86)\Steam\steamapps\common\The Jackbox Party Pack 2\games\Earwax\content\*" .\public\sounds\Earwax\ -Recurse
   ```

3. **Verify the files**:
   - Check that `public\sounds\Earwax\EarwaxAudio\` contains the sound effect files
   - Check that `public\sounds\Earwax\EarwaxPrompts\` contains the prompt files

**Note**: You must own Jackbox Party Pack 2 to legally use these audio files.

### Running the Game

1. **Start the server**:

   ```bash
   npm run dev
   ```

2. **Open Main Screen** (TV/Display):

   - Navigate to `http://localhost:3000`
   - Click "Main Screen Mode"
   - This shows the shared game display

3. **Join as Players** (Phones/Devices):
   - Navigate to `http://localhost:3000` on each player device
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
- ✅ Responsive design for mobile and TV interfaces
- ✅ Player avatar system with colors
- ✅ Scoring and winner announcements

## Development

### Project Structure

```
fartnoises/
├── public/                     # Static assets
│   ├── sounds/                 # Audio files
│   │   ├── Earwax/            # Original Earwax game audio
│   │   ├── GameEffects/       # UI sound effects (activate, judge, etc.)
│   │   └── Music/             # Background music tracks
│   └── *.svg                  # Icon assets
├── scripts/                    # Development and testing scripts
│   ├── test-*.ts              # Multiplayer and bot testing scripts
│   ├── scan-*.ts              # Audio file scanning utilities
│   └── debug-*.ts             # Debugging tools
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx           # Landing/home page
│   │   ├── game/              # Player device interface routes
│   │   ├── main-screen/       # TV display interface routes
│   │   └── debug/             # Debug and testing pages
│   ├── components/            # React components
│   │   ├── client/            # Client-side components
│   │   ├── mainscreen/        # Main screen specific components
│   │   ├── shared/            # Shared components
│   │   └── ui/                # UI library components
│   ├── data/
│   │   └── gameData.ts        # Sound effects and prompts data
│   ├── hooks/                 # Custom React hooks
│   │   ├── useSocket.ts       # Socket.IO connection management
│   │   ├── useAudio*.ts       # Audio playback hooks
│   │   ├── useGame*.ts        # Game state management hooks
│   │   └── use*.ts            # Various utility hooks
│   ├── pages/api/             # API routes
│   │   └── socket.ts          # Socket.IO server setup
│   ├── server/                # Server-side utilities
│   │   ├── handlers/          # Socket event handlers
│   │   ├── types/             # Server type definitions
│   │   └── utils/             # Server utilities
│   ├── types/
│   │   └── game.ts            # TypeScript type definitions
│   └── utils/                 # Client utilities
│       ├── audioSystem.ts     # Audio playback system
│       ├── gameUtils.ts       # Game logic utilities
│       └── soundLoader.ts     # Audio file loading
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── next.config.ts             # Next.js configuration
└── README.md                  # This file
```

### Customization

- **Game Settings**: Modify `GAME_CONFIG` for rounds, timers, etc.
- **Colors**: Update `PLAYER_COLORS` for avatar colors
- **Sounds**: Add new sound effects to the library

### Adding Custom Sounds and Prompts

The game loads sound effects and prompts from `.jet` files (JSON format) that match the original Jackbox structure. You can add your own content by modifying these files.

#### Sound Effects Structure

Sound effects are defined in `public/sounds/Earwax/EarwaxAudio.jet`:

```json
{
    "episodeid": 1234,
    "content": [
        {
            "x": false,                    // false = safe content, true = explicit
            "name": "deodorant/spray paint spray",
            "short": "deodorant/spray paint spray",
            "id": 22199,                   // Unique identifier
            "categories": [                // Used for filtering/organization
                "household"
            ]
        },
        {
            "x": false,
            "name": "compressed air release",
            "short": "compressed air release", 
            "id": 22222,
            "categories": [
                "tools"
            ]
        }
    ]
}
```

**Adding Custom Sound Effects:**

1. **Add audio files** to `public/sounds/Earwax/EarwaxAudio/` with the naming pattern `{id}.mp3`
2. **Edit the .jet file** to include your new sound:

```json
{
    "x": false,
    "name": "my custom sound effect",
    "short": "custom sound",
    "id": 99999,                // Use a unique ID (high number to avoid conflicts)
    "categories": [
        "custom",
        "funny"
    ]
}
```

#### Game Prompts Structure

Prompts are defined in `public/sounds/Earwax/EarwaxPrompts.jet`:

```json
{
    "content": [
        {
            "id": 23594,
            "x": false,                    // false = safe content, true = explicit
            "PromptAudio": "414727_1f",    // Optional: audio file name (without .mp3)
            "name": "purple nurple"        // The prompt text displayed to players
        },
        {
            "id": 23593,
            "x": false,
            "PromptAudio": "414725_0f",
            "name": "I shouldn't have eaten that expired meat."
        }
    ]
}
```

**Adding Custom Prompts:**

1. **Add the prompt** to the .jet file:

```json
{
    "id": 99999,                // Use a unique ID
    "x": false,
    "PromptAudio": null,        // Optional: leave null if no audio
    "name": "your funny custom prompt here"
}
```

2. **Optional: Add prompt audio** to `public/sounds/Earwax/EarwaxPrompts/` if you want narrated prompts

#### Content Guidelines

- **Safe vs Explicit**: Use `"x": false` for family-friendly content, `"x": true` for adult content
- **Categories**: Use relevant categories like `["funny", "household", "animals", "vehicle"]`
- **Unique IDs**: Always use unique ID numbers (suggest starting at 90000+ for custom content)
- **Audio Format**: Use MP3 files for compatibility

#### Example: Adding a Custom Sound Pack

```json
// Add to EarwaxAudio.jet content array:
{
    "x": false,
    "name": "cat meowing",
    "short": "cat meow",
    "id": 90001,
    "categories": ["animals", "pets"]
},
{
    "x": false,
    "name": "dog barking",
    "short": "dog bark",
    "id": 90002,
    "categories": ["animals", "pets"]
}
```

Then add `90001.mp3` and `90002.mp3` to the `EarwaxAudio` folder.

**Note**: The game automatically loads and uses any content in these .jet files, so changes take effect after restarting the server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test multiplayer functionality
5. Submit a pull request

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**.

**TL;DR**: You can share, modify, and build upon this game, but not for commercial purposes. Any derivatives must be shared under the same license.

📄 See [LICENSE.md](LICENSE.md) for full license details.

## Credits & Attributions

### Original Inspiration

Inspired by **Earwax** from Jackbox Games - thank you for creating such entertaining party games!

### Audio Assets

- Music and sound effects sourced from [Pixabay](https://pixabay.com/)
- Used under Pixabay's Content License

### Special Thanks

With heartfelt gratitude to my friends and family who supported, tested, and provided feedback during development. Your enthusiasm and laughter made this project possible! ❤️

---

Created with love for hilarious party game nights! 🎉
