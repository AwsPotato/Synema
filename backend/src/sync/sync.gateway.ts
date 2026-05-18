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

@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data;
    client.join(roomId);
    console.log(`Client ${client.id} joined room ${roomId}`);
    
    // Notify the room that a user has joined
    this.server.to(roomId).emit('userJoined', { clientId: client.id });
  }

  @SubscribeMessage('video:play')
  handleVideoPlay(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:play in room ${roomId} at ${currentTime}`);
    client.broadcast.to(roomId).emit('video:play', { currentTime });
  }

  @SubscribeMessage('video:pause')
  handleVideoPause(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:pause in room ${roomId} at ${currentTime}`);
    client.broadcast.to(roomId).emit('video:pause', { currentTime });
  }

  @SubscribeMessage('video:seek')
  handleVideoSeek(
    @MessageBody() data: { roomId: string; currentTime: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, currentTime } = data;
    console.log(`video:seek in room ${roomId} to ${currentTime}`);
    client.broadcast.to(roomId).emit('video:seek', { currentTime });
  }
}
