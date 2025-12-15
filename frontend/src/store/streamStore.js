import { create } from 'zustand';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://3.233.242.245:443/api';
const API_URL = import.meta.env.VITE_API_URL || 'https://3.233.242.245:443/api';

export const useStreamStore = create((set, get) => ({
  socket: null,
  device: null,
  sendTransport: null,
  recvTransport: null,
  producers: {
    video: null,
    audio: null
  },
  consumers: [],
  stream: null,
  isConnected: false,
  viewerCount: 0,

  connectSocket: async (token) => {
    const socket = io(SOCKET_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    set({ socket });
    return socket;
  },

  initializeDevice: async (rtpCapabilities) => {
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    set({ device });
    return device;
  },

  createSendTransport: async (streamId) => {
    const { socket, device } = get();
    if (!socket || !device) throw new Error('Socket or device not initialized');

    return new Promise((resolve, reject) => {
      socket.emit('create-transport', { streamId, direction: 'send' }, async ({ params, error }) => {
        if (error) {
          reject(new Error(error));
          return;
        }

        const transport = device.createSendTransport({
          id: params.id,
          iceParameters: params.iceParameters,
          iceCandidates: params.iceCandidates,
          dtlsParameters: params.dtlsParameters
        });

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          socket.emit('connect-transport', {
            streamId,
            transportId: params.id,
            dtlsParameters
          }, ({ success, error }) => {
            if (error) {
              errback(new Error(error));
            } else {
              callback();
            }
          });
        });

        transport.on('produce', async (parameters, callback, errback) => {
          socket.emit('produce', {
            streamId,
            transportId: params.id,
            kind: parameters.kind,
            rtpParameters: parameters.rtpParameters
          }, ({ id, error }) => {
            if (error) {
              errback(new Error(error));
            } else {
              callback({ id });
            }
          });
        });

        set({ sendTransport: transport });
        resolve(transport);
      });
    });
  },

  createRecvTransport: async (streamId) => {
    const { socket, device } = get();
    if (!socket || !device) throw new Error('Socket or device not initialized');

    return new Promise((resolve, reject) => {
      socket.emit('create-transport', { streamId, direction: 'recv' }, async ({ params, error }) => {
        if (error) {
          reject(new Error(error));
          return;
        }

        const transport = device.createRecvTransport({
          id: params.id,
          iceParameters: params.iceParameters,
          iceCandidates: params.iceCandidates,
          dtlsParameters: params.dtlsParameters
        });

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          socket.emit('connect-transport', {
            streamId,
            transportId: params.id,
            dtlsParameters
          }, ({ success, error }) => {
            if (error) {
              errback(new Error(error));
            } else {
              callback();
            }
          });
        });

        set({ recvTransport: transport });
        resolve(transport);
      });
    });
  },

  produceVideo: async (streamId, track) => {
    const { sendTransport } = get();
    if (!sendTransport) throw new Error('Transport not initialized');

    const producer = await sendTransport.produce({ track });
    
    set(state => ({
      producers: { ...state.producers, video: producer }
    }));

    return producer;
  },

  produceAudio: async (streamId, track) => {
    const { sendTransport } = get();
    if (!sendTransport) throw new Error('Transport not initialized');

    const producer = await sendTransport.produce({ track });
    
    set(state => ({
      producers: { ...state.producers, audio: producer }
    }));

    return producer;
  },

  consumeProducer: async (streamId, producerId, kind) => {
    const { socket, recvTransport, device } = get();
    if (!recvTransport || !device) throw new Error('Transport or device not initialized');

    return new Promise((resolve, reject) => {
      socket.emit('consume', {
        streamId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities
      }, async ({ params, error }) => {
        if (error) {
          reject(new Error(error));
          return;
        }

        const consumer = await recvTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters
        });

        socket.emit('resume-consumer', { consumerId: consumer.id }, () => {
          set(state => ({
            consumers: [...state.consumers, consumer]
          }));
          resolve(consumer);
        });
      });
    });
  },

  pauseProducer: async (producerId) => {
    const { socket } = get();
    socket.emit('pause-producer', { producerId }, ({ success, error }) => {
      if (error) console.error('Pause error:', error);
    });
  },

  resumeProducer: async (producerId) => {
    const { socket } = get();
    socket.emit('resume-producer', { producerId }, ({ success, error }) => {
      if (error) console.error('Resume error:', error);
    });
  },

  setViewerCount: (count) => set({ viewerCount: count }),

  cleanup: () => {
    const { socket, sendTransport, recvTransport, producers, consumers } = get();
    
    if (producers.video) producers.video.close();
    if (producers.audio) producers.audio.close();
    consumers.forEach(consumer => consumer.close());
    if (sendTransport) sendTransport.close();
    if (recvTransport) recvTransport.close();
    if (socket) socket.disconnect();

    set({
      socket: null,
      device: null,
      sendTransport: null,
      recvTransport: null,
      producers: { video: null, audio: null },
      consumers: [],
      isConnected: false
    });
  }
}));

