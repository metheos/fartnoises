interface AudioActivationBannerProps {
  /** Whether audio is ready (banner shows when false) */
  isAudioReady: boolean;
  /** Callback to activate audio */
  onActivateAudio: () => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

export default function AudioActivationBanner({ 
  isAudioReady, 
  onActivateAudio, 
  className = "" 
}: AudioActivationBannerProps) {
  // Don't render if audio is already ready
  if (isAudioReady) return null;

  return (
    <div className={`bg-yellow-100 border-2 border-yellow-400 rounded-3xl p-6 text-center ${className}`}>
      <div className="flex items-center justify-center space-x-4">
        <div className="text-3xl">🔊</div>
        <div>
          <h3 className="text-xl font-bold text-yellow-800 mb-2">Enable Audio</h3>
          <p className="text-yellow-700 mb-4">Click to enable sound for the main screen</p>
          <button
            onClick={onActivateAudio}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-xl transition-colors"
          >
            🎵 Enable Audio
          </button>
        </div>
      </div>
    </div>
  );
}
