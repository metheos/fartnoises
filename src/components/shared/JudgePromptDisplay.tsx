import { Player, GamePrompt } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface JudgePromptDisplayProps {
  judge: Player | undefined;
  prompt: GamePrompt | undefined;
  showPrompt?: boolean;
  showJudge?: boolean;
  size?: 'small' | 'large';
}

export function JudgePromptDisplay({ 
  judge, 
  prompt, 
  showPrompt = true,
  showJudge = true,
  size = 'large'
}: JudgePromptDisplayProps) {
  const isSmall = size === 'small';
  
  return (
    <div className={`flex ${showPrompt ? (isSmall ? 'items-center' : 'items-center lg:items-center') : 'items-start'} justify-center gap-3 md:gap-6 ${isSmall ? 'mb-4' : 'mb-8'} ${showPrompt && showJudge ? (isSmall ? 'flex-col' : 'flex-col lg:flex-row') : 'flex-row'}`}>
      {/* Judge Display - Left Side */}
      {showJudge && (
        <div className={`flex-shrink-0 ${showPrompt ? 'w-auto' : 'w-auto'}`}>
          <div className={`relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl ${isSmall ? 'p-2' : 'p-3'} shadow-2xl border-1 border-yellow-400 overflow-hidden ${showPrompt && !isSmall ? 'lg:mx-0' : ''}`}>
            
            {/* Main judge content */}
            <div className={`relative z-10 flex flex-col items-center`}>
              <div className={`bg-white bg-opacity-90 rounded-2xl ${isSmall ? 'px-2 py-1' : 'px-4 py-1'} shadow-lg border-1 border-yellow-300 text-center`}>
                
                {/* Judge Title */}
                <div className={`${isSmall ? 'mb-1' : 'mb-3'}`}>
                  <span className={`${isSmall ? 'text-sm' : 'text-xl'} font-black text-amber-900 drop-shadow-sm underline`}>The Judge</span>
                </div>
                
                {/* Judge avatar - larger and more prominent */}
                <div className={`relative ${isSmall ? 'mb-1' : 'mb-3'}`}>
                  <div 
                    className={`${isSmall ? 'w-16 h-16 text-2xl ring-2' : 'w-28 h-28 text-5xl ring-6'} rounded-full flex items-center justify-center font-bold text-white shadow-2xl ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge?.color || '#gray')}`}
                  >
                    {judge?.emoji || judge?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                </div>
                
                {/* Judge name with emphasis */}
                <div className="">
                  <span className={`${isSmall ? 'text-sm' : 'text-xl'} font-black text-amber-900 drop-shadow-sm`}>{judge?.name || 'Unknown'}</span>
                </div>
              </div>
            </div>
            
            {/* Animated border glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
          </div>
        </div>
      )}
      
      {/* Prompt Display - Right Side */}
      {showPrompt && prompt && (
        <div className={`flex-1 min-w-0 ${showPrompt ? 'w-full' : 'max-w-4xl'}`}>
          <div className={`relative bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 rounded-3xl ${isSmall ? 'p-3' : 'p-8'} shadow-2xl ${isSmall ? 'border-2' : 'border-4'} border-purple-300 overflow-hidden`}>
            
            {/* Main prompt text */}
            <div className="relative z-10">
              <div className={`bg-white bg-opacity-90 rounded-2xl ${isSmall ? 'p-3' : 'p-6'} shadow-lg ${isSmall ? 'border-1' : 'border-2'} border-purple-200`}>
                <div className="flex items-center justify-center mb-2">
                </div>
                <p className={`${isSmall ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'} text-center text-gray-800 font-bold leading-relaxed drop-shadow-sm break-words word-wrap overflow-wrap-anywhere`} dangerouslySetInnerHTML={{ __html: prompt.text }}></p>
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