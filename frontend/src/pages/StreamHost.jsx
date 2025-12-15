import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import StreamControls from '../components/StreamControls';
import ChatPanel from '../components/ChatPanel';
import { ArrowLeft, Users, Copy } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://3.233.242.245:4000';

export default function StreamHost() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user, supabase } = useAuthStore();
  const {
    socket,
    device,
    sendTransport,
    producers,
    connectSocket,
    initializeDevice,
    createSendTransport,
    produceVideo,
    produceAudio,
    pauseProducer,
    resumeProducer,
    cleanup,
    viewerCount,
    setViewerCount
  } = useStreamStore();

  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    initializeStream();
    return () => {
      cleanup();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [streamId]);

  const initializeStream = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const streamRes = await fetch(`${API_URL}/api/streams/${streamId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const streamData = await streamRes.json();
      setStream(streamData);
      setIsLive(streamData.is_live);

      const socket = await connectSocket(session.access_token);
      socket.emit('join-stream', { streamId, role: 'host' });

      socket.on('viewer-count', ({ count }) => {
        setViewerCount(count);
      });

      const rtpCapabilities = await new Promise((resolve, reject) => {
        socket.emit('get-router-rtp-capabilities', { streamId }, ({ rtpCapabilities, error }) => {
          if (error) reject(new Error(error));
          else resolve(rtpCapabilities);
        });
      });

      await initializeDevice(rtpCapabilities);
      await createSendTransport(streamId);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      setLocalStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      await produceVideo(streamId, videoTrack);
      await produceAudio(streamId, audioTrack);
    } catch (error) {
      console.error('Error initializing stream:', error);
    }
  };

  const startStream = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      await fetch(`${API_URL}/api/streams/${streamId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          rtmp_url: null
        })
      });
      setIsLive(true);
    } catch (error) {
      console.error('Error starting stream:', error);
    }
  };

  const stopStream = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      await fetch(`${API_URL}/api/streams/${streamId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      setIsLive(false);
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  const toggleVideo = async () => {
    if (producers.video) {
      if (isVideoPaused) {
        await resumeProducer(producers.video.id);
        setIsVideoPaused(false);
      } else {
        await pauseProducer(producers.video.id);
        setIsVideoPaused(true);
      }
    }
  };

  const toggleAudio = async () => {
    if (producers.audio) {
      if (isAudioMuted) {
        await resumeProducer(producers.audio.id);
        setIsAudioMuted(false);
      } else {
        await pauseProducer(producers.audio.id);
        setIsAudioMuted(true);
      }
    }
  };

  const copyViewerLink = () => {
    const link = `${window.location.origin}/watch/${streamId}`;
    navigator.clipboard.writeText(link);
    alert('Viewer link copied!');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold">{stream?.title || 'Stream'}</h1>
              {isLive && (
                <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-5 h-5" />
                {viewerCount} viewers
              </div>
              <button
                onClick={copyViewerLink}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          <StreamControls
            isLive={isLive}
            isVideoPaused={isVideoPaused}
            isAudioMuted={isAudioMuted}
            onStart={startStream}
            onStop={stopStream}
            onToggleVideo={toggleVideo}
            onToggleAudio={toggleAudio}
          />
        </div>

        <div className="w-96 bg-gray-800 border-l border-gray-700">
          <ChatPanel streamId={streamId} userId={user?.id} />
        </div>
      </div>
    </div>
  );
}

