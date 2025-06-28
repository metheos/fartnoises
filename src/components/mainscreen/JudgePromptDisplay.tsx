import { Player, GamePrompt } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface JudgePromptDisplayProps {
  judge: Player | undefined;
  prompt: GamePrompt | undefined;
  showPrompt?: boolean;
}

export function JudgePromptDisplay({ 
  judge, 
  prompt, 
  showPrompt = true 
}: JudgePromptDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-6 mb-8">
      {/* Judge Display - Left Side */}
      <div className="flex-shrink-0">
        <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
          
          {/* Main judge content */}
          <div className="relative z-10 flex flex-col items-center min-w-50">
            <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 w-full text-center">
              
              {/* Judge Title */}
              <div className="mb-3">
                <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
              </div>
              
              {/* Judge avatar - larger and more prominent */}
              <div className="relative mb-3">
                <div 
                  className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge?.color || '#gray')}`}
                >
                  {judge?.emoji || judge?.name?.[0]?.toUpperCase() || '?'}
                </div>
              </div>
              
              {/* Judge name with emphasis */}
              <div className="">
                <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>
          
          {/* Animated border glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
        </div>
      </div>
      
      {/* Prompt Display - Right Side */}
      {showPrompt && prompt && (
        <div className="flex-grow max-w-4xl">
          <div className="relative bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 rounded-3xl p-8 shadow-2xl border-4 border-purple-300 overflow-hidden">
            
            {/* Main prompt text */}
            <div className="relative z-10">
              <div className="bg-white bg-opacity-90 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
                <div className="flex items-center justify-center mb-2">
                </div>
                <p className="text-3xl text-center text-gray-800 font-bold leading-relaxed drop-shadow-sm" dangerouslySetInnerHTML={{ __html: prompt.text }}></p>
                <div className="flex items-center justify-center mt-2">
                </div>
              </div>
            </div>
            
            {/* Animated border glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 opacity-20 animate-pulse"></div>
          </div>
        </div>
      )}
    </div>
  );
}