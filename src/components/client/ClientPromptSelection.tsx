'use client';

import { Room, Player, GamePrompt } from '@/types/game';
import { Card, Button, JudgeDisplay } from '@/components/ui';
import { useJudgeCheck } from '@/hooks';

interface ClientPromptSelectionProps {
  room: Room;
  player: Player;
  onSelectPrompt: (promptId: string) => void;
}

export default function ClientPromptSelection({ 
  room, 
  player, 
  onSelectPrompt 
}: ClientPromptSelectionProps) {
  const { isJudge, judgeDisplayProps } = useJudgeCheck(room, player, {
    displaySize: 'lg',
    customMessage: 'Selecting a prompt...'
  });
  
  // Debug logging to see what prompts we're receiving
  console.log('PromptSelectionComponent - Available prompts:', room.availablePrompts);
  
  return (
    <Card className="text-center">
      {isJudge ? (
        <>
          <p className="text-gray-800 mb-4">Choose a prompt for this round:</p>
          <div className="space-y-3">
            {room.availablePrompts?.map((prompt: GamePrompt) => (
              <Button
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt.id)}
                variant="primary"
                className="w-full"
                aria-label={`Select prompt: ${prompt.text.replace(/<[^>]*>/g, '')}`}
              >
                <span dangerouslySetInnerHTML={{ __html: prompt.text }} />
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-gray-800">
          {judgeDisplayProps && (
            <JudgeDisplay {...judgeDisplayProps} />
          )}
          <p className="mt-4">Waiting for the Judge to select a prompt...</p>
        </div>
      )}
    </Card>
  );
}
