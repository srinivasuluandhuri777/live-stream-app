import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MediaServer } from './mediasoup/server.js';
import { streamRoutes } from './routes/streams.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

const mediaServer = new MediaServer();

// Protected routes require authentication
app.use('/api/streams', authMiddleware(supabase), streamRoutes(supabase, mediaServer));

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      socket.userId = user.id;
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.userId);

  socket.on('join-stream', async ({ streamId, role }) => {
    try {
      socket.join(streamId);
      
      if (role === 'viewer' && socket.userId) {
        await supabase.from('stream_viewers').upsert({
          stream_id: streamId,
          user_id: socket.userId,
          joined_at: new Date().toISOString()
        }, {
          onConflict: 'stream_id,user_id'
        });
        
        const { count } = await supabase
          .from('stream_viewers')
          .select('*', { count: 'exact', head: true })
          .eq('stream_id', streamId);
        
        io.to(streamId).emit('viewer-count', { count });
      }
      
      socket.emit('joined-stream', { streamId, role });
    } catch (error) {
      console.error('Error joining stream:', error);
      socket.emit('error', { message: 'Failed to join stream' });
    }
  });

  socket.on('leave-stream', async ({ streamId }) => {
    socket.leave(streamId);
    
    if (socket.userId) {
      await supabase
        .from('stream_viewers')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', socket.userId);
      
      const { count } = await supabase
        .from('stream_viewers')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);
      
      io.to(streamId).emit('viewer-count', { count });
    }
  });

  socket.on('get-router-rtp-capabilities', async ({ streamId }, callback) => {
    try {
      const router = await mediaServer.getOrCreateRouter(streamId);
      const rtpCapabilities = router.rtpCapabilities;
      callback({ rtpCapabilities });
    } catch (error) {
      console.error('Error getting RTP capabilities:', error);
      callback({ error: error.message });
    }
  });

  socket.on('get-producers', async ({ streamId }, callback) => {
    try {
      const producers = await mediaServer.getProducers(streamId);
      callback(producers);
    } catch (error) {
      console.error('Error getting producers:', error);
      callback([]);
    }
  });

  socket.on('create-transport', async ({ streamId, direction }, callback) => {
    try {
      const router = await mediaServer.getOrCreateRouter(streamId);
      const transport = await mediaServer.createTransport(router, direction, socket.id);
      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      });
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('connect-transport', async ({ streamId, transportId, dtlsParameters }, callback) => {
    try {
      await mediaServer.connectTransport(socket.id, transportId, dtlsParameters);
      callback({ success: true });
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('produce', async ({ streamId, transportId, kind, rtpParameters }, callback) => {
    try {
      const router = await mediaServer.getOrCreateRouter(streamId);
      const producer = await mediaServer.createProducer(
        router,
        socket.id,
        transportId,
        { kind, rtpParameters }
      );
      
      socket.emit('producer-created', {
        id: producer.id,
        kind: producer.kind
      });
      
      io.to(streamId).except(socket.id).emit('new-producer', {
        producerId: producer.id,
        kind: producer.kind
      });
      
      callback({ id: producer.id });
    } catch (error) {
      console.error('Error producing:', error);
      callback({ error: error.message });
    }
  });

  socket.on('consume', async ({ streamId, transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const router = await mediaServer.getOrCreateRouter(streamId);
      const { consumer, params } = await mediaServer.createConsumer(
        router,
        socket.id,
        transportId,
        producerId,
        rtpCapabilities
      );
      
      callback({ params });
    } catch (error) {
      console.error('Error consuming:', error);
      callback({ error: error.message });
    }
  });

  socket.on('resume-consumer', async ({ consumerId }, callback) => {
    try {
      await mediaServer.resumeConsumer(socket.id, consumerId);
      callback({ success: true });
    } catch (error) {
      console.error('Error resuming consumer:', error);
      callback({ error: error.message });
    }
  });

  socket.on('pause-producer', async ({ producerId }, callback) => {
    try {
      await mediaServer.pauseProducer(socket.id, producerId);
      callback({ success: true });
    } catch (error) {
      console.error('Error pausing producer:', error);
      callback({ error: error.message });
    }
  });

  socket.on('resume-producer', async ({ producerId }, callback) => {
    try {
      await mediaServer.resumeProducer(socket.id, producerId);
      callback({ success: true });
    } catch (error) {
      console.error('Error resuming producer:', error);
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.userId);
    await mediaServer.cleanupSocket(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  mediaServer.initialize();
});

