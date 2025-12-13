import mediasoup from 'mediasoup';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class MediaServer {
  constructor() {
    this.workers = [];
    this.routers = new Map();
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.ffmpegProcesses = new Map();
  }

  async initialize() {
    const numWorkers = parseInt(process.env.MEDIASOUP_NUM_WORKERS || '1');
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 40000,
        rtcMaxPort: 49999
      });

      worker.on('died', () => {
        console.error('Mediasoup worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }

    console.log(`Initialized ${this.workers.length} mediasoup workers`);
  }

  getWorker() {
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }

  async getOrCreateRouter(streamId) {
    if (this.routers.has(streamId)) {
      return this.routers.get(streamId);
    }

    const worker = this.getWorker();
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        }
      ]
    });

    this.routers.set(streamId, router);
    return router;
  }

  async createTransport(router, direction, socketId) {
    const transport = await router.createWebRtcTransport({
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined
        }
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });

    const transportKey = `${socketId}:${transport.id}`;
    this.transports.set(transportKey, { transport, socketId, router });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        this.transports.delete(transportKey);
      }
    });

    transport.on('close', () => {
      this.transports.delete(transportKey);
    });

    return transport;
  }

  async connectTransport(socketId, transportId, dtlsParameters) {
    const transportKey = `${socketId}:${transportId}`;
    const transportData = this.transports.get(transportKey);
    
    if (!transportData) {
      throw new Error('Transport not found');
    }

    await transportData.transport.connect({ dtlsParameters });
  }

  async createProducer(router, socketId, transportId, { kind, rtpParameters }) {
    const transportKey = `${socketId}:${transportId}`;
    const transportData = this.transports.get(transportKey);
    
    if (!transportData) {
      throw new Error('Transport not found');
    }

    const producer = await transportData.transport.produce({
      kind,
      rtpParameters
    });

    const producerKey = `${socketId}:${producer.id}`;
    this.producers.set(producerKey, { producer, socketId, router });

    producer.on('transportclose', () => {
      this.producers.delete(producerKey);
    });

    return producer;
  }

  async createConsumer(router, socketId, transportId, producerId, rtpCapabilities) {
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const producer = Array.from(this.producers.values())
      .find(p => p.producer.id === producerId)?.producer;

    if (!producer) {
      throw new Error('Producer not found');
    }

    const transportKey = `${socketId}:${transportId}`;
    const transportData = this.transports.get(transportKey);
    
    if (!transportData) {
      throw new Error('Transport not found');
    }

    const consumer = await transportData.transport.consume({
      producerId,
      rtpCapabilities,
      paused: false
    });

    const consumerKey = `${socketId}:${consumer.id}`;
    this.consumers.set(consumerKey, { consumer, socketId });

    consumer.on('transportclose', () => {
      this.consumers.delete(consumerKey);
    });

    return {
      consumer,
      params: {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      }
    };
  }

  async pauseProducer(socketId, producerId) {
    const producerKey = Array.from(this.producers.entries())
      .find(([key, value]) => value.producer.id === producerId)?.[0];
    
    if (!producerKey) {
      throw new Error('Producer not found');
    }

    const { producer } = this.producers.get(producerKey);
    await producer.pause();
  }

  async resumeProducer(socketId, producerId) {
    const producerKey = Array.from(this.producers.entries())
      .find(([key, value]) => value.producer.id === producerId)?.[0];
    
    if (!producerKey) {
      throw new Error('Producer not found');
    }

    const { producer } = this.producers.get(producerKey);
    await producer.resume();
  }

  async resumeConsumer(socketId, consumerId) {
    const consumerKey = `${socketId}:${consumerId}`;
    const consumerData = this.consumers.get(consumerKey);
    
    if (!consumerData) {
      throw new Error('Consumer not found');
    }

    await consumerData.consumer.resume();
  }

  async startRTMPRestream(streamId, rtmpUrl) {
    const router = this.routers.get(streamId);
    if (!router) {
      throw new Error('Router not found');
    }

    const producers = Array.from(this.producers.values())
      .filter(p => p.router === router && p.producer.kind === 'video');

    if (producers.length === 0) {
      throw new Error('No video producer found');
    }

    const videoProducer = producers[0].producer;
    const audioProducers = Array.from(this.producers.values())
      .filter(p => p.router === router && p.producer.kind === 'audio');
    const audioProducer = audioProducers.length > 0 ? audioProducers[0].producer : null;

    const ffmpegArgs = [
      '-f', 'rawvideo',
      '-pixel_format', 'yuv420p',
      '-video_size', '1280x720',
      '-framerate', '30',
      '-i', 'pipe:0',
      '-f', 'pulse',
      '-i', 'default',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-f', 'flv',
      rtmpUrl
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    this.ffmpegProcesses.set(streamId, ffmpeg);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      this.ffmpegProcesses.delete(streamId);
    });

    videoProducer.on('transportclose', () => {
      if (this.ffmpegProcesses.has(streamId)) {
        this.ffmpegProcesses.get(streamId).kill();
        this.ffmpegProcesses.delete(streamId);
      }
    });
  }

  async stopRTMPRestream(streamId) {
    const ffmpeg = this.ffmpegProcesses.get(streamId);
    if (ffmpeg) {
      ffmpeg.kill();
      this.ffmpegProcesses.delete(streamId);
    }
  }

  async getProducers(streamId) {
    const router = this.routers.get(streamId);
    if (!router) {
      return [];
    }

    const producers = [];
    for (const [key, value] of this.producers.entries()) {
      if (value.router === router) {
        producers.push({
          id: value.producer.id,
          kind: value.producer.kind
        });
      }
    }
    return producers;
  }

  async cleanupSocket(socketId) {
    const transportsToDelete = [];
    for (const [key, value] of this.transports.entries()) {
      if (value.socketId === socketId) {
        transportsToDelete.push(key);
        value.transport.close();
      }
    }
    transportsToDelete.forEach(key => this.transports.delete(key));

    const producersToDelete = [];
    for (const [key, value] of this.producers.entries()) {
      if (value.socketId === socketId) {
        producersToDelete.push(key);
        value.producer.close();
      }
    }
    producersToDelete.forEach(key => this.producers.delete(key));

    const consumersToDelete = [];
    for (const [key, value] of this.consumers.entries()) {
      if (value.socketId === socketId) {
        consumersToDelete.push(key);
        value.consumer.close();
      }
    }
    consumersToDelete.forEach(key => this.consumers.delete(key));
  }
}

