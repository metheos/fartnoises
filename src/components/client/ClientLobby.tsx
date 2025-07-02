'use client';

import { Room, Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { Card, Button, GameSettingsPanel, PlayerAvatar } from '@/components/ui';

interface ClientLobbyProps {
  room: Room;
  player: Player;
  onStartGame: () => void;
  onUpdateGameSetting: (setting: 'maxScore' | 'maxRounds' | 'allowExplicitContent', value: number | boolean) => void;
}

export default function ClientLobby({ 
  room, 
  player, 
  onStartGame, 
  onUpdateGameSetting 
}: ClientLobbyProps) {
  const mainScreenCount = room.mainScreenCount || 0;
  
  return (
    <Card className="text-center">
      {/* Main Screen Status */}
      <div className={`mb-4 p-3 rounded-xl ${
        mainScreenCount > 0 
          ? 'bg-green-100 border-2 border-green-300' 
          : 'bg-orange-100 border-2 border-orange-300'
      }`}>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl">
            {mainScreenCount > 0 ? '📺' : '📱'}
          </span>
          <div className="text-left flex-grow">
            {mainScreenCount > 0 ? (
              <>
                <p className="text-green-800 font-bold text-sm">
                  {mainScreenCount} Main Screen{mainScreenCount > 1 ? 's' : ''} Connected
                </p>
                <p className="text-green-700 text-xs">
                  Enhanced game experience active! Sound playback, judging displays, and results will show on the main screen.
                </p>
              </>
            ) : (
              <>
                <p className="text-orange-800 font-bold text-sm">
                  No Main Screen Connected
                </p>
                <p className="text-orange-700 text-xs">
                  Connect a shared main screen (TV/projector) for the best experience! Players can still play without it.
                </p>
                {/* <p className="text-orange-600 text-xs mt-1 italic">
                  💡 Tip: Open the main screen page on a TV or shared device
                </p> */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Game Settings Display/Controls */}
      <GameSettingsPanel
        room={room}
        canEdit={player.isVIP}
        onUpdateSetting={onUpdateGameSetting}
        className="mb-6"
      />
      
      {/* Player List */}
      <ul className="mb-4 text-left max-w-xs mx-auto space-y-3">
        {room.players.map((p) => (
          <li
            key={p.id}
            className={`
              flex items-center gap-3 p-2 rounded-2xl shadow-md transition-all duration-200
              ${getPlayerColorClass(p.color)}
              ${p.id === player.id ? 'ring-4 ring-purple-400 scale-105' : ''}
              ${p.isVIP ? 'border-2 border-yellow-300' : ''}
              text-white
            `}
            style={{
              background: p.isVIP
                ? 'linear-gradient(90deg, #fef08a 0%, #fde047 100%)'
                : undefined,
              color: p.isVIP ? '#92400e' : undefined,
              boxShadow: p.id === player.id ? '0 0 0 4px #a78bfa44' : undefined,
            }}
          >
            <PlayerAvatar
              player={p}
              size="xs"
              showName={false}
              isHighlighted={p.isVIP}
              highlightStyle="vip"
              className="mr-2"
            />
            <div className="flex flex-col flex-grow">
              <span className="font-bold text-lg flex items-center gap-1">
                {p.name}
                {p.isVIP && (
                  <span
                    className="ml-1 text-yellow-400 text-xl animate-bounce"
                    title="Host"
                  >
                    👑
                  </span>
                )}
                {p.id === player.id && (
                  <span className="ml-1 text-purple-200 text-xs font-semibold bg-purple-600 bg-opacity-60 px-2 py-0.5 rounded-full">
                    You
                  </span>
                )}
              </span>
              {/* <span className="text-xs opacity-80">
                {p.isVIP ? 'Host' : 'Player'}
              </span> */}
            </div>
            {/* <span className="ml-auto font-black text-lg drop-shadow">
              {p.score}
            </span> */}
          </li>
        ))}
      </ul>
      {player.isVIP && room.players.length >= 3 && (
        <Button 
          onClick={onStartGame} 
          variant="success"
          size="lg"
        >
          Start Game
        </Button>
      )}
      {!player.isVIP && room.players.length >= 3 && <p className="text-gray-700">Waiting for the host to start the game...</p>}
      {player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start the game. ({room.players.length}/3)</p>}
      {!player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start. Waiting for more players to join... ({room.players.length}/3)</p>}
    </Card>
  );
}
