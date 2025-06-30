'use client';

import { Room, Player, GamePrompt } from '@/types/game';
import { Card, Button } from '@/components/ui';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
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
  const { isJudge, judge } = useJudgeCheck(room, player);
  
  // Debug logging to see what prompts we're receiving
  console.log('PromptSelectionComponent - Available prompts:', room.availablePrompts);
  
  return (
    <Card className="text-center">
      {isJudge ? (
        <>
          {/* Judge Display for the judge themselves */}
          {/* <div className="mb-6">
            <JudgePromptDisplay 
              judge={judge || undefined} 
              prompt={undefined} 
              showPrompt={false} 
              size="small"
            />
          </div> */}
          
          {/* <p className="text-gray-800 mb-4">Choose a prompt for this round:</p> */}
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
          <JudgePromptDisplay 
            judge={judge || undefined} 
            prompt={undefined} 
            showPrompt={false} 
            size="small"
          />
          <p className="mt-4">Waiting for the Judge to select a prompt...</p>
        </div>
      )}
    </Card>
  );
}
