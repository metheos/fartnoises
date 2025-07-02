import React, { useState, useEffect, useCallback } from 'react';
import { AudioSystem } from '../../utils/audioSystem';

interface AudioDebugInfo {
  canInitialize: boolean;
  isInitialized: boolean;
  hasAudioContext: boolean;
  audioContextState?: string;
  userInteractionDetected: boolean;
  documentState: {
    hasFocus: boolean;
    visibility: string;
    readyState: string;
  };
  browserSupport: boolean;
}

export const AudioSystemDebugger: React.FC = () => {
  const [audioSystem] = useState(() => AudioSystem.getInstance());
  const [debugInfo, setDebugInfo] = useState<AudioDebugInfo | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  const refreshDebugInfo = useCallback(() => {
    const info = audioSystem.getAudioReadinessInfo();
    setDebugInfo(info);
    console.log('🔊 Audio System Debug Info:', info);
  }, [audioSystem]);

  const testCanInitialize = () => {
    const canInit = audioSystem.canInitialize();
    const timestamp = new Date().toLocaleTimeString();
    const result = `${timestamp}: canInitialize() = ${canInit}`;
    setTestResults(prev => [...prev.slice(-9), result]); // Keep last 10 results
    console.log('🔊', result);
  };

  const handleUserInteraction = () => {
    audioSystem.markUserInteraction();
    const timestamp = new Date().toLocaleTimeString();
    const result = `${timestamp}: User interaction marked`;
    setTestResults(prev => [...prev.slice(-9), result]);
    refreshDebugInfo();
  };

  const initializeAudio = async () => {
    try {
      await audioSystem.initialize();
      const timestamp = new Date().toLocaleTimeString();
      const result = `${timestamp}: Audio initialized successfully`;
      setTestResults(prev => [...prev.slice(-9), result]);
      refreshDebugInfo();
    } catch (error) {
      const timestamp = new Date().toLocaleTimeString();
      const result = `${timestamp}: Audio initialization failed: ${error}`;
      setTestResults(prev => [...prev.slice(-9), result]);
      console.error('Audio initialization failed:', error);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    
    // Set up interval to refresh debug info
    const interval = setInterval(refreshDebugInfo, 2000);
    
    return () => clearInterval(interval);
  }, [refreshDebugInfo]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Audio System Debugger</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Controls</h2>
          <div className="space-y-2">
            <button
              onClick={testCanInitialize}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Test canInitialize()
            </button>
            <button
              onClick={handleUserInteraction}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Mark User Interaction
            </button>
            <button
              onClick={initializeAudio}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Initialize Audio
            </button>
            <button
              onClick={refreshDebugInfo}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Refresh Debug Info
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Debug Info</h2>
          {debugInfo && (
            <div className="space-y-2 text-sm">
              <div className={`p-2 rounded ${debugInfo.canInitialize ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <strong>Can Initialize:</strong> {debugInfo.canInitialize ? 'YES' : 'NO'}
              </div>
              <div className={`p-2 rounded ${debugInfo.isInitialized ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <strong>Is Initialized:</strong> {debugInfo.isInitialized ? 'YES' : 'NO'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Has AudioContext:</strong> {debugInfo.hasAudioContext ? 'YES' : 'NO'}
                {debugInfo.audioContextState && (
                  <span className="ml-2">({debugInfo.audioContextState})</span>
                )}
              </div>
              <div className={`p-2 rounded ${debugInfo.userInteractionDetected ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <strong>User Interaction:</strong> {debugInfo.userInteractionDetected ? 'YES' : 'NO'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Browser Support:</strong> {debugInfo.browserSupport ? 'YES' : 'NO'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Document State:</strong>
                <ul className="ml-4 mt-1">
                  <li>Focus: {debugInfo.documentState.hasFocus ? 'YES' : 'NO'}</li>
                  <li>Visibility: {debugInfo.documentState.visibility}</li>
                  <li>Ready State: {debugInfo.documentState.readyState}</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white p-4 rounded-lg shadow mt-6">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No test results yet. Click the buttons above to test.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index}>{result}</div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-6">
        <h3 className="font-semibold text-yellow-800 mb-2">Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-yellow-700">
          <li>The page should auto-initialize audio after user interaction</li>
          <li>Check &quot;Can Initialize&quot; and &quot;Is Initialized&quot; - both should show YES automatically</li>
          <li>If auto-init fails, you can manually click &quot;Initialize Audio&quot;</li>
          <li>Test playing sounds to verify audio is working</li>
          <li>Open browser dev tools to see detailed console logs</li>
        </ol>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <strong>Auto-Initialization:</strong>
          <ul className="mt-1 ml-4">
            <li><strong>User Interaction Tracking:</strong> Page automatically detects clicks/touches</li>
            <li><strong>Auto-Init:</strong> Audio initializes automatically when interaction is detected</li>
            <li><strong>Fallback:</strong> Manual activation still available if auto-init fails</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AudioSystemDebugger;
