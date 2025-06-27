interface WaveformAnimationProps {
  /** Whether the waveform should be visible and animating */
  isPlaying: boolean;
  /** Color of the waveform bars - defaults to white */
  color?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Size variant for the waveform */
  size?: 'sm' | 'md' | 'lg';
}

export function WaveformAnimation({ 
  isPlaying, 
  color = 'bg-white', 
  className = '', 
  size = 'md' 
}: WaveformAnimationProps) {
  // Different size configurations
  const sizeConfig = {
    sm: {
      container: 'mt-4',
      bars: ['h-2', 'h-3', 'h-2', 'h-3', 'h-2', 'h-3', 'h-2', 'h-3']
    },
    md: {
      container: 'mt-6',
      bars: ['h-4', 'h-6', 'h-3', 'h-5', 'h-4', 'h-6', 'h-3', 'h-5']
    },
    lg: {
      container: 'mt-8',
      bars: ['h-6', 'h-8', 'h-5', 'h-7', 'h-6', 'h-8', 'h-5', 'h-7']
    }
  };

  const config = sizeConfig[size];

  if (!isPlaying) {
    return <div className={`${config.container} flex justify-center space-x-1 ${className}`}></div>;
  }

  return (
    <div className={`${config.container} flex justify-center space-x-1 ${className}`}>
        <span>Hello World</span>
      {config.bars.map((height, index) => (
        <div 
          key={index}
          className={`w-1 ${height} ${color} rounded-full animate-pulse`}
        ></div>
      ))}
    </div>
  );
}
