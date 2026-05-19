import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

interface RoomState {
  videoSrc: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdatedAt: number; // Unix timestamp in ms
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly redisService: RedisService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  private async getRoomState(roomId: string): Promise<RoomState | null> {
    const data = await this.redisService.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  }

  private async saveRoomState(roomId: string, state: RoomState) {
    // Save state, expire after 24 hours of inactivity
    await this.redisService.set(`room:${roomId}`, JSON.stringify(state), 86400);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data;
    client.join(roomId);
    console.log(`Client ${client.id} joined room ${roomId}`);
    
    // Notify the room that a user has joined
    this.server.to(roomId).emit('userJoined', { clientId: client.id });

    // Send current room state to the newly joined client
    const state = await this.getRoomState(roomId);
    if (state) {
      client.emit('room:state', state);
    }
  }

  @SubscribeMessage('video:source')
  async handleVideoSource(
    @MessageBody() data: { roomId: string; source: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, source } = data;
    console.log(`video:source in room ${roomId} to ${source}`);
    
    const state: RoomState = {
      videoSrc: source,
      currentTime: 0,
      isPlaying: false,
      lastUpdatedAt: Date.now(),
    };
    
    await this.saveRoomState(roomId, state);
    client.broadcast.to(roomId).emit('video:source', { source });
  }

  @SubscribeMessage('video:play')
  async handleVideoPlay(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:play in room ${roomId} at ${currentTime}`);
    
    const state = await this.getRoomState(roomId);
    if (state) {
      state.currentTime = currentTime;
      state.isPlaying = true;
      state.lastUpdatedAt = Date.now();
      await this.saveRoomState(roomId, state);
    }
    
    client.broadcast.to(roomId).emit('video:play', { currentTime });
  }

  @SubscribeMessage('video:pause')
  async handleVideoPause(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:pause in room ${roomId} at ${currentTime}`);
    
    const state = await this.getRoomState(roomId);
    if (state) {
      state.currentTime = currentTime;
      state.isPlaying = false;
      state.lastUpdatedAt = Date.now();
      await this.saveRoomState(roomId, state);
    }
    
    client.broadcast.to(roomId).emit('video:pause', { currentTime });
  }

  @SubscribeMessage('video:seek')
  async handleVideoSeek(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:seek in room ${roomId} to ${currentTime}`);
    
    const state = await this.getRoomState(roomId);
    if (state) {
      state.currentTime = currentTime;
      state.lastUpdatedAt = Date.now();
      await this.saveRoomState(roomId, state);
    }
    
    client.broadcast.to(roomId).emit('video:seek', { currentTime });
  }
}
