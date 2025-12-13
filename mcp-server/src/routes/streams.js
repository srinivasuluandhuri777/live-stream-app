import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

export const streamRoutes = (supabase, mediaServer) => {
  const router = express.Router();

  // Helper to create Supabase client with user's access token
  const getUserSupabase = (accessToken) => {
    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
  };

  router.post('/create', async (req, res) => {
    try {
      const { title, scheduled_at } = req.body;
      const hostId = req.user.id;
      const streamKey = uuidv4();
      
      // Get user's access token from request
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      
      // Create Supabase client with user's token for RLS
      const userSupabase = getUserSupabase(accessToken);

      const { data, error } = await userSupabase
        .from('stream_sessions')
        .insert({
          host_id: hostId,
          stream_key: streamKey,
          title: title || 'Untitled Stream',
          scheduled_at: scheduled_at || null,
          is_live: false
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, stream: data });
    } catch (error) {
      console.error('Error creating stream:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:streamId/start', async (req, res) => {
    try {
      const { streamId } = req.params;
      const { rtmp_url } = req.body;
      const hostId = req.user.id;
      
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      const userSupabase = getUserSupabase(accessToken);

      const { data: stream, error: fetchError } = await userSupabase
        .from('stream_sessions')
        .select('*')
        .eq('id', streamId)
        .eq('host_id', hostId)
        .single();

      if (fetchError || !stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const { error: updateError } = await userSupabase
        .from('stream_sessions')
        .update({
          is_live: true,
          started_at: new Date().toISOString()
        })
        .eq('id', streamId);

      if (updateError) throw updateError;

      if (rtmp_url) {
        try {
          await mediaServer.startRTMPRestream(streamId, rtmp_url);
        } catch (rtmpError) {
          console.error('RTMP restream error:', rtmpError);
        }
      }

      res.json({ success: true, message: 'Stream started' });
    } catch (error) {
      console.error('Error starting stream:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:streamId/stop', async (req, res) => {
    try {
      const { streamId } = req.params;
      const hostId = req.user.id;
      
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      const userSupabase = getUserSupabase(accessToken);

      const { data: stream, error: fetchError } = await userSupabase
        .from('stream_sessions')
        .select('*')
        .eq('id', streamId)
        .eq('host_id', hostId)
        .single();

      if (fetchError || !stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const { error: updateError } = await userSupabase
        .from('stream_sessions')
        .update({
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', streamId);

      if (updateError) throw updateError;

      await mediaServer.stopRTMPRestream(streamId);

      res.json({ success: true, message: 'Stream stopped' });
    } catch (error) {
      console.error('Error stopping stream:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:streamId', async (req, res) => {
    try {
      const { streamId } = req.params;
      
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      const userSupabase = getUserSupabase(accessToken);

      const { data: stream, error } = await userSupabase
        .from('stream_sessions')
        .select('*')
        .eq('id', streamId)
        .single();

      if (error || !stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const { count: viewerCount } = await supabase
        .from('stream_viewers')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      const { count: likeCount } = await supabase
        .from('stream_likes')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      res.json({
        ...stream,
        viewer_count: viewerCount || 0,
        like_count: likeCount || 0
      });
    } catch (error) {
      console.error('Error fetching stream:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/host/list', async (req, res) => {
    try {
      const hostId = req.user.id;
      
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      const userSupabase = getUserSupabase(accessToken);

      const { data: streams, error } = await userSupabase
        .from('stream_sessions')
        .select('*')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ streams });
    } catch (error) {
      console.error('Error fetching streams:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/live', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];
      const userSupabase = getUserSupabase(accessToken);

      // Fetch all live streams
      const { data: streams, error } = await userSupabase
        .from('stream_sessions')
        .select('*')
        .eq('is_live', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Get viewer and like counts for each stream
      const streamsWithCounts = await Promise.all(
        (streams || []).map(async (stream) => {
          const { count: viewerCount } = await supabase
            .from('stream_viewers')
            .select('*', { count: 'exact', head: true })
            .eq('stream_id', stream.id);

          const { count: likeCount } = await supabase
            .from('stream_likes')
            .select('*', { count: 'exact', head: true })
            .eq('stream_id', stream.id);

          return {
            ...stream,
            viewer_count: viewerCount || 0,
            like_count: likeCount || 0
          };
        })
      );

      res.json({ streams: streamsWithCounts });
    } catch (error) {
      console.error('Error fetching live streams:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

