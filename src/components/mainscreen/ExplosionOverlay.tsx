'use client';

import { useState, useEffect } from 'react';

interface ExplosionOverlayProps {
  isExploding: boolean;
  judgeName: string;
  onExplosionComplete: () => void;
}

export default function ExplosionOverlay({ 
  isExploding, 
  judgeName, 
  onExplosionComplete 
}: ExplosionOverlayProps) {
  const [stage, setStage] = useState<'hidden' | 'warning' | 'exploding' | 'falling' | 'complete'>('hidden');
  const [warningCount, setWarningCount] = useState(3);

  useEffect(() => {
    if (!isExploding) {
      setStage('hidden');
      setWarningCount(3);
      return;
    }

    // Stage 1: Warning countdown (3, 2, 1...)
    setStage('warning');
    
    const warningInterval = setInterval(() => {
      setWarningCount(prev => {
        if (prev <= 1) {
          clearInterval(warningInterval);
          setStage('exploding');
          return 0;
        }
        return prev - 1;
      });
    }, 800);

    // Stage 2: Explosion effect (after warning)
    const explosionTimer = setTimeout(() => {
      setStage('exploding');
      
      // Stage 3: Falling apart effect
      const fallingTimer = setTimeout(() => {
        setStage('falling');
        
        // Stage 4: Complete and callback
        const completeTimer = setTimeout(() => {
          setStage('complete');
          onExplosionComplete();
        }, 2000); // 2 seconds for falling animation
        
        return () => clearTimeout(completeTimer);
      }, 1500); // 1.5 seconds for explosion
      
      return () => clearTimeout(fallingTimer);
    }, 3000); // 3 seconds for warning countdown

    return () => {
      clearInterval(warningInterval);
      clearTimeout(explosionTimer);
    };
  }, [isExploding, onExplosionComplete]);

  if (stage === 'hidden') return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Warning Stage */}
      {stage === 'warning' && (
        <div className="absolute inset-0 bg-red-900 bg-opacity-80 flex items-center justify-center animate-pulse">
          <div className="text-center text-white">
            <div className="text-8xl font-black mb-4 animate-bounce">⚠️</div>
            <h1 className="text-6xl font-black mb-8 text-yellow-300 animate-pulse">
              NUCLEAR OPTION ACTIVATED
            </h1>
            <p className="text-3xl font-bold mb-6">
              Judge {judgeName} couldn't decide!
            </p>
            <div className="text-9xl font-black text-red-400 animate-bounce">
              {warningCount}
            </div>
          </div>
          
          {/* Warning stripes */}
          <div className="absolute inset-0 opacity-30">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute h-full w-8 bg-yellow-400 transform -skew-x-12 animate-pulse"
                style={{
                  left: `${i * 5}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Explosion Stage */}
      {stage === 'exploding' && (
        <div className="absolute inset-0 bg-orange-500 overflow-hidden">
          {/* Main explosion */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-orange-400 to-red-600 animate-ping" />
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-300 via-orange-500 to-red-700 animate-pulse" />
          
          {/* Explosion particles */}
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-4 h-4 bg-yellow-300 rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${0.5 + Math.random() * 1}s`
              }}
            />
          ))}

          {/* Explosion text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white drop-shadow-2xl">
              <div className="text-9xl font-black animate-spin mb-4">💥</div>
              <h1 className="text-8xl font-black animate-bounce">BOOM!</h1>
            </div>
          </div>
        </div>
      )}

      {/* Falling Apart Stage */}
      {stage === 'falling' && (
        <div className="absolute inset-0 bg-black overflow-hidden">
          {/* Screen fragments falling */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white opacity-80 rounded-lg shadow-2xl"
              style={{
                width: `${50 + Math.random() * 100}px`,
                height: `${50 + Math.random() * 100}px`,
                left: `${Math.random() * 100}%`,
                top: '-100px',
                animation: `fall ${1 + Math.random() * 2}s ease-in forwards`,
                animationDelay: `${Math.random() * 1}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}

          {/* Fading text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-400 animate-pulse opacity-60">
              <h1 className="text-6xl font-black mb-4">SYSTEM DESTROYED</h1>
              <p className="text-2xl">Moving to next round...</p>
            </div>
          </div>

          {/* Add the falling animation keyframes via style tag */}
          <style jsx>{`
            @keyframes fall {
              0% {
                transform: translateY(-100px) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}

      {/* Complete Stage */}
      {stage === 'complete' && (
        <div className="absolute inset-0 bg-black opacity-90 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-6xl font-black animate-pulse">☠️</div>
            <p className="text-2xl mt-4">Round skipped...</p>
          </div>
        </div>
      )}
    </div>
  );
}
