# Sound Management Scripts

This directory contains scripts to help manage and maintain the sound files for the fartnoises game.

## 🎵 Background Music Management

### `scan-music-files.ts`

Automatically scans the `/public/sounds/Music/` folders and updates the `useBackgroundMusic.ts` hook with newly added music files.

**Usage:**

```bash
npm run scan:music
```

**What it does:**

- Scans all subdirectories in `/public/sounds/Music/`
- Detects .mp3, .wav, .ogg, and .m4a files
- Automatically updates the `knownFiles` object in `useBackgroundMusic.ts`
- Preserves existing code structure

## 🎮 Game Effects Management

### `scan-game-effects.ts`

Automatically scans the `/public/sounds/GameEffects/` folders and updates the `useGameplayEffects.ts` hook with newly added sound effect files.

**Usage:**

```bash
npm run scan:effects
```

**What it does:**

- Scans all subdirectories in `/public/sounds/GameEffects/`
- Detects .mp3, .wav, .ogg, and .m4a files
- Automatically updates the `effectFiles` object in `useGameplayEffects.ts`
- Maintains random selection functionality for multiple files per effect

**Current Effect Categories:**

- `activate` - UI activation sounds (button clicks, selections)
- `failunsafe` - Failure/error sounds
- `gameover` - Game completion sounds
- `judge` - Judge reveal/selection sounds
- `like` - Like/appreciation sounds
- `point` - Point scoring sounds
- `reveal` - Prompt/content reveal sounds
- `roundresult` - Round completion sounds

## 🔄 Workflow for Adding New Sounds

### Adding Background Music:

1. Place new music files in the appropriate `/public/sounds/Music/[Category]/` folder
2. Run `npm run scan:music`
3. The hook will be automatically updated

### Adding Game Effects:

1. Place new effect files in the appropriate `/public/sounds/GameEffects/[Effect]/` folder
2. Run `npm run scan:effects`
3. The hook will be automatically updated
4. Multiple files in the same effect folder will be randomly selected during gameplay

### Creating New Effect Categories:

1. Create a new folder in `/public/sounds/GameEffects/`
2. Add sound files to the folder
3. Run `npm run scan:effects`
4. The new category will be automatically detected and added

## 🎛️ Random Sound Selection

The game effects system supports multiple files per effect category. When an effect is triggered:

- The system randomly selects one file from the effect's folder
- This adds variety to the gameplay experience
- Example: `roundresult` folder contains both `level-win-6416.mp3` and `victory_beat.mp3`

## 🔧 Technical Details

Both scripts:

- Use TypeScript for type safety
- Automatically preserve existing code structure
- Generate properly formatted objects
- Include error handling and fallbacks
- Provide detailed console output
- Support common audio formats (mp3, wav, ogg, m4a)

## 📁 File Structure

```
public/sounds/
├── Music/
│   ├── GameOver/
│   ├── Judging/
│   ├── Lobby/
│   ├── RoundResults/
│   └── Selection/
└── GameEffects/
    ├── activate/
    ├── failunsafe/
    ├── gameover/
    ├── judge/
    ├── like/
    ├── point/
    ├── reveal/
    └── roundresult/
```
