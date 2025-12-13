import { Video, VideoOff, Mic, MicOff, Play, Square } from 'lucide-react';

export default function StreamControls({
  isLive,
  isVideoPaused,
  isAudioMuted,
  onStart,
  onStop,
  onToggleVideo,
  onToggleAudio
}) {
  return (
    <div className="bg-gray-800 p-4 flex items-center justify-center gap-4">
      {!isLive ? (
        <button
          onClick={onStart}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold"
        >
          <Play className="w-5 h-5" />
          Go Live
        </button>
      ) : (
        <>
          <button
            onClick={onToggleVideo}
            className={`p-3 rounded-lg ${
              isVideoPaused ? 'bg-gray-700' : 'bg-blue-600'
            } hover:opacity-80`}
          >
            {isVideoPaused ? (
              <VideoOff className="w-6 h-6" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </button>
          <button
            onClick={onToggleAudio}
            className={`p-3 rounded-lg ${
              isAudioMuted ? 'bg-gray-700' : 'bg-blue-600'
            } hover:opacity-80`}
          >
            {isAudioMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
          <button
            onClick={onStop}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold"
          >
            <Square className="w-5 h-5" />
            End Stream
          </button>
        </>
      )}
    </div>
  );
}

