COPILOT EDITS OPERATIONAL GUIDELINES
PRIME DIRECTIVE
include the proper newline separation when making replacements
Avoid working on more than one file at a time.
Multiple simultaneous edits to a file will cause corruption.
Be chatting and teach about what you are doing while coding.

LARGE FILE & COMPLEX CHANGE PROTOCOL
MANDATORY PLANNING PHASE
When working with large files (>300 lines) or complex changes:

ALWAYS start by creating a detailed plan BEFORE making any edits
Your plan MUST include:
All functions/sections that need modification
The order in which changes should be applied
Dependencies between changes
Estimated number of separate edits required

Format your plan as:

PROPOSED EDIT PLAN
Working with: [filename]
Total planned edits: [number]

MAKING EDITS
include the proper newline separation when making replacements
Always ensure there's a proper newline before any def statement
Use replace_string_in_file with sufficient context to see the line structure
Double-check the oldString includes proper spacing/newlines
Focus on one conceptual change at a time
Show clear "before" and "after" snippets when proposing changes
Include concise explanations of what changed and why
Always check if the edit maintains the project's coding style

Edit sequence:
[First specific change] - Purpose: [why]
[Second specific change] - Purpose: [why]
Do you approve this plan? I'll proceed with Edit [number] after your confirmation.
WAIT for explicit user confirmation before making ANY edits when user ok edit [number]

EXECUTION PHASE
After each individual edit, clearly indicate progress:"✅ Completed edit [#] of [total]. Ready for next edit?"
If you discover additional needed changes during editing:
STOP and update the plan
Get approval before continuing

REFACTORING GUIDANCE
When refactoring large files:

Break work into logical, independently functional chunks
Ensure each intermediate state maintains functionality
Consider temporary duplication as a valid interim step
Always indicate the refactoring pattern being applied

RATE LIMIT AVOIDANCE
For very large files, suggest splitting changes across multiple sessions
Prioritize changes that are logically complete units
Always provide clear stopping points

RUNNING COMMANDS
terminal commands you try to run as an agent are in powershell format.

# Copilot Instructions for fartnoises

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is a **fartnoises** game - a quirky, sound-based party game for 3-8 players. The game consists of:

1. **Main Screen Interface** - Displayed on TV/shared display for all players to see
2. **Player Device Controllers** - Phone/tablet/computer interfaces for individual player interactions
3. **Real-time Multiplayer** - Uses Socket.IO for synchronized gameplay

## Technical Stack

- **Framework**: Next.js 15 with TypeScript and App Router
- **Styling**: Tailwind CSS for modern, colorful UI
- **Real-time Communication**: Socket.IO for multiplayer functionality
- **Audio**: Web Audio API for sound effects and playback

## Game Flow

1. **Lobby**: Players join by entering 4-letter room codes on their devices
2. **Judge Selection**: One player becomes judge per round
3. **Prompt Phase**: Judge selects from 3 weird prompts
4. **Sound Selection**: Other players choose 2 sound effects to match the prompt
5. **Playback**: All sound combos are played back anonymously
6. **Judging**: Judge picks the best/funniest combo
7. **Scoring**: Winner gets a point, repeat with new judge

## Code Style Guidelines

- Use TypeScript for all components
- Implement responsive design for both main screen and mobile devices
- Create reusable components for game phases
- Use Tailwind classes for bright, playful, modern UI
- Implement proper error handling for network disconnections
- Add loading states and smooth transitions between game phases

## Command Line & Terminal Instructions

**IMPORTANT**: This project runs on Windows with PowerShell as the default shell. When generating any terminal commands or scripts:

- Always use PowerShell syntax (not bash/zsh)
- Use Windows-style file paths with backslashes (`\`) or forward slashes (`/`)
- Use PowerShell-compatible commands:
  - `Get-ChildItem` or `ls` (not `ls -la`)
  - `Copy-Item` or `cp` (not `cp -r`)
  - `Remove-Item` or `rm` (not `rm -rf`)
  - `New-Item -ItemType Directory` or `mkdir` for creating directories
  - Use `.ps1` extension for PowerShell scripts
- Package manager commands should use `npm`, `yarn`, or `pnpm` as appropriate
- When running multiple commands, use `;` or `&&` appropriately for PowerShell
- File operations should account for Windows file system conventions

Example acceptable commands:

```powershell
npm install
npm run dev
mkdir components
Copy-Item .\src\* .\backup\ -Recurse
Get-ChildItem -Path .\src -Recurse -Filter "*.ts"
```

## Sound Effects

- Use a curated list of funny/quirky sound effects
- Implement sound preview functionality
- Handle audio playback timing and synchronization
- Consider using placeholder sounds initially, mark them as replaceable

## Key Features to Implement

- Room creation and joining with 4-letter codes
- Player avatar system with simple colored icons
- Judge rotation system
- Sound effect library and selection interface
- Real-time game state synchronization
- Scoring system and winner announcement
- Responsive design for main screen vs. mobile interfaces
