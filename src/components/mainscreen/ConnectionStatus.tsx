interface ConnectionStatusProps {
  /** Whether the connection is established */
  isConnected: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom loading message */
  message?: string;
  /** App name to show in loading */
  appName?: string;
}

export default function ConnectionStatus({ 
  isConnected, 
  className = "",
  message = "Setting up the main screen...",
  appName = "fartnoises"
}: ConnectionStatusProps) {
  // Don't render if already connected
  if (isConnected) return null;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center ${className}`}>
      <div className="bg-white rounded-3xl p-6 text-center shadow-2xl transition-all duration-300 min-h-[75vh]">
        <div className="animate-spin w-24 h-24 border-8 border-purple-500 border-t-transparent rounded-full mx-auto mb-8"></div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Connecting to {appName}</h2>
        <p className="text-gray-800 text-xl">{message}</p>
      </div>
    </div>
  );
}
