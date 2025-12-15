import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import ChatPanel from '../components/ChatPanel';
import { Heart, Users, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://3.233.242.245:4000';

export default function StreamViewer() {
  const { streamId } = useParams();
  const { user, supabase } = useAuthStore();
  const {
    socket,
    device,
    recvTransport,
    consumers,
    connectSocket,
    initializeDevice,
    createRecvTransport,
    consumeProducer,
    cleanup,
    viewerCount,
    setViewerCount
  } = useStreamStore();

  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    initializeViewer();
    return () => {
      cleanup();
    };
  }, [streamId]);

  const initializeViewer = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const streamRes = await fetch(`${API_URL}/api/streams/${streamId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!streamRes.ok) {
        const errorData = await streamRes.json().catch(() => ({ error: 'Failed to fetch stream' }));
        console.error('Stream fetch error:', errorData);
        setLoading(false);
        return;
      }
      
      const streamData = await streamRes.json();
      setStream(streamData);
      setLikeCount(streamData.like_count || 0);
      setLoading(false);

      if (!streamData.is_live) {
        return;
      }

      const socket = await connectSocket(session.access_token);
      socket.emit('join-stream', { streamId, role: 'viewer' });

      socket.on('viewer-count', ({ count }) => {
        setViewerCount(count);
      });

      socket.on('new-producer', async ({ producerId, kind }) => {
        if (kind === 'video' || kind === 'audio') {
          await consumeProducer(streamId, producerId, kind);
        }
      });

      const rtpCapabilities = await new Promise((resolve, reject) => {
        socket.emit('get-router-rtp-capabilities', { streamId }, ({ rtpCapabilities, error }) => {
          if (error) reject(new Error(error));
          else resolve(rtpCapabilities);
        });
      });

      await initializeDevice(rtpCapabilities);
      await createRecvTransport(streamId);

      const existingProducers = await new Promise((resolve) => {
        socket.emit('get-producers', { streamId }, (producers) => {
          resolve(producers || []);
        });
      });

      for (const producer of existingProducers) {
        await consumeProducer(streamId, producer.id, producer.kind);
      }
    } catch (error) {
      console.error('Error initializing viewer:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consumers.length > 0 && videoRef.current) {
      const videoConsumer = consumers.find(c => c.kind === 'video');
      const audioConsumer = consumers.find(c => c.kind === 'audio');
      
      // Get or create MediaStream
      let stream = videoRef.current.srcObject;
      if (!stream || !(stream instanceof MediaStream)) {
        stream = new MediaStream();
        videoRef.current.srcObject = stream;
      }
      
      // Add video track if available
      if (videoConsumer && videoConsumer.track) {
        const existingVideoTrack = stream.getVideoTracks()[0];
        if (existingVideoTrack !== videoConsumer.track) {
          if (existingVideoTrack) {
            stream.removeTrack(existingVideoTrack);
          }
          stream.addTrack(videoConsumer.track);
        }
      }
      
      // Add audio track if available
      if (audioConsumer && audioConsumer.track) {
        const existingAudioTrack = stream.getAudioTracks()[0];
        if (existingAudioTrack !== audioConsumer.track) {
          if (existingAudioTrack) {
            stream.removeTrack(existingAudioTrack);
          }
          stream.addTrack(audioConsumer.track);
          // Ensure audio track is enabled
          audioConsumer.track.enabled = true;
        }
      }
      
      // Ensure video element is not muted
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    }
  }, [consumers]);

  const handleLike = async () => {
    if (!user) return;

    try {
      if (liked) {
        await supabase
          .from('stream_likes')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', user.id);
        setLiked(false);
        setLikeCount(prev => prev - 1);
      } else {
        await supabase
          .from('stream_likes')
          .insert({
            stream_id: streamId,
            user_id: user.id
          });
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream Not Found</h1>
          <p className="text-gray-400">The stream you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (!stream.is_live) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{stream.title || 'Stream'}</h1>
          <p className="text-gray-400 mb-4">This stream is not currently live.</p>
          {stream.scheduled_at && (
            <p className="text-sm text-gray-500">
              Scheduled for: {new Date(stream.scheduled_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-800 p-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">{stream.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-5 h-5" />
                {viewerCount} viewers
              </div>
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  liked ? 'bg-red-500' : 'bg-gray-700'
                } hover:bg-red-600`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                {likeCount}
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-contain"
            />
            {consumers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="w-96 bg-gray-800 border-l border-gray-700">
          <ChatPanel streamId={streamId} userId={user?.id} />
        </div>
      </div>
    </div>
  );
}

