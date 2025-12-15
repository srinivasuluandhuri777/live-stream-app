import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Video, Users, Heart, LogOut, Play } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://3.233.242.245:4000';

export default function ViewerDashboard() {
  const { user, supabase, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveStreams();
  }, []);

  const fetchLiveStreams = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Fetch all live streams
      const response = await fetch(`${API_URL}/api/streams/live`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const { streams: data } = await response.json();
        setStreams(data || []);
      }
    } catch (error) {
      console.error('Error fetching live streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-800">Live Streams</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Host Dashboard
              </button>
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">Loading live streams...</div>
        ) : streams.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">No Live Streams</h2>
            <p>There are no streams currently live. Check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <div key={stream.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                <div className="aspect-video bg-gray-900 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <span className="text-sm">Live Stream</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{stream.title}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {stream.viewer_count || 0} viewers
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      {stream.like_count || 0}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/watch/${stream.id}`)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Watch Stream
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

