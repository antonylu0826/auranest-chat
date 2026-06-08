import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from './messages/messages.service';
import { ReactionsService } from './reactions/reactions.service';
import { ReadStateService } from './read-state/read-state.service';
import { CreateMessageDto } from './messages/dto/create-message.dto';

interface JwtUser {
  sub: string;
  email: string;
  name?: string;
  roleNames: string[];
}

interface AuthSocket extends Socket {
  data: { user: JwtUser };
}

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3041';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: CORS_ORIGIN, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly reactionsService: ReactionsService,
    private readonly readStateService: ReadStateService,
  ) {}

  async handleConnection(socket: AuthSocket) {
    try {
      const token =
        socket.handshake.auth?.token ??
        (socket.handshake.query?.token as string | undefined);

      if (!token) throw new Error('Missing token');

      let user: JwtUser;
      if (process.env.AUTH_MODE === 'oidc') {
        // TODO (OIDC): verify RS256 via JWKS. Local auth is the Phase 1 target.
        // For now, reject OIDC connections at the gateway until JWKS verify is wired.
        throw new Error('OIDC mode not yet supported on WebSocket gateway');
      } else {
        const payload = this.jwtService.verify<JwtUser>(token);
        user = {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          roleNames: payload.roleNames ?? [],
        };
      }

      socket.data.user = user;

      // Auto-join all rooms the user has access to
      const [memberships, dmParticipations] = await Promise.all([
        this.prisma.channelMember.findMany({ where: { userId: user.sub }, select: { channelId: true } }),
        this.prisma.dmParticipant.findMany({ where: { userId: user.sub }, select: { conversationId: true } }),
      ]);

      const rooms = [
        ...memberships.map((m) => `channel:${m.channelId}`),
        ...dmParticipations.map((p) => `dm:${p.conversationId}`),
      ];
      await Promise.all([
        ...rooms.map((r) => socket.join(r)),
        socket.join(`user:${user.sub}`),
      ]);

      socket.emit('ready', { userId: user.sub, rooms });
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: AuthSocket) {
    // Socket.IO automatically removes the socket from all rooms on disconnect
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  }

  // ── Room management ───────────────────────────────────────────────────────

  /** Re-join all rooms the user currently has access to (used after creating a new channel or DM). */
  @SubscribeMessage('room:rejoin')
  async handleRoomRejoin(@ConnectedSocket() socket: AuthSocket) {
    const [memberships, dmParticipations] = await Promise.all([
      this.prisma.channelMember.findMany({ where: { userId: socket.data.user.sub }, select: { channelId: true } }),
      this.prisma.dmParticipant.findMany({ where: { userId: socket.data.user.sub }, select: { conversationId: true } }),
    ]);
    const rooms = [
      ...memberships.map((m) => `channel:${m.channelId}`),
      ...dmParticipations.map((p) => `dm:${p.conversationId}`),
    ];
    await Promise.all(rooms.map((r) => socket.join(r)));
    return { rooms };
  }

  // ── Channels ──────────────────────────────────────────────────────────────

  /** Explicit join: verifies membership before calling socket.join() (IDOR guard). */
  @SubscribeMessage('channel:join')
  async handleChannelJoin(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() channelId: string,
  ) {
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: socket.data.user.sub } },
    });
    if (!member) throw new WsException('Forbidden: not a member of this channel');
    await socket.join(`channel:${channelId}`);
    return { channelId };
  }

  /** Explicit join: verifies participation before calling socket.join() (IDOR guard). */
  @SubscribeMessage('dm:join')
  async handleDmJoin(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() conversationId: string,
  ) {
    const participant = await this.prisma.dmParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: socket.data.user.sub } },
    });
    if (!participant) throw new WsException('Forbidden: not a participant of this conversation');
    await socket.join(`dm:${conversationId}`);
    return { conversationId };
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() dto: CreateMessageDto,
  ) {
    const message = await this.messagesService.create(socket.data.user.sub, dto);
    const room = dto.channelId ? `channel:${dto.channelId}` : `dm:${dto.dmId}`;
    this.server.to(room).emit('message:new', message);
    return message;
  }

  @SubscribeMessage('message:edit')
  async handleMessageEdit(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { messageId: string; content: string },
  ) {
    const updated = await this.messagesService.update(payload.messageId, socket.data.user.sub, {
      content: payload.content,
    });
    const room = updated.channelId ? `channel:${updated.channelId}` : `dm:${updated.dmId}`;
    this.server.to(room).emit('message:updated', updated);
    return updated;
  }

  @SubscribeMessage('message:delete')
  async handleMessageDelete(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() messageId: string,
  ) {
    const isAdmin = socket.data.user.roleNames.includes('ADMIN');
    const deleted = await this.messagesService.softDelete(messageId, socket.data.user.sub, isAdmin);
    const room = deleted.channelId ? `channel:${deleted.channelId}` : `dm:${deleted.dmId}`;
    this.server.to(room).emit('message:deleted', { id: messageId, channelId: deleted.channelId, dmId: deleted.dmId });
    return { id: messageId };
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  @SubscribeMessage('reaction:add')
  async handleReactionAdd(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const aggregated = await this.reactionsService.add(payload.messageId, socket.data.user.sub, payload.emoji);
    const message = await this.prisma.message.findUnique({ where: { id: payload.messageId }, select: { channelId: true, dmId: true } });
    if (!message) throw new WsException('Message not found');
    const room = message.channelId ? `channel:${message.channelId}` : `dm:${message.dmId}`;
    this.server.to(room).emit('reaction:updated', {
      messageId: payload.messageId,
      reactions: aggregated,
      channelId: message.channelId,
      dmId: message.dmId,
    });
    return aggregated;
  }

  @SubscribeMessage('reaction:remove')
  async handleReactionRemove(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const aggregated = await this.reactionsService.remove(payload.messageId, socket.data.user.sub, payload.emoji);
    const message = await this.prisma.message.findUnique({ where: { id: payload.messageId }, select: { channelId: true, dmId: true } });
    if (!message) throw new WsException('Message not found');
    const room = message.channelId ? `channel:${message.channelId}` : `dm:${message.dmId}`;
    this.server.to(room).emit('reaction:updated', {
      messageId: payload.messageId,
      reactions: aggregated,
      channelId: message.channelId,
      dmId: message.dmId,
    });
    return aggregated;
  }

  // ── Typing indicators ─────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { channelId?: string; dmId?: string },
  ) {
    const room = payload.channelId ? `channel:${payload.channelId}` : `dm:${payload.dmId}`;
    socket.to(room).emit('typing', {
      userId: socket.data.user.sub,
      name: socket.data.user.name,
      ...payload,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { channelId?: string; dmId?: string },
  ) {
    const room = payload.channelId ? `channel:${payload.channelId}` : `dm:${payload.dmId}`;
    socket.to(room).emit('typing', {
      userId: socket.data.user.sub,
      name: socket.data.user.name,
      ...payload,
      typing: false,
    });
  }

  // ── Read state ────────────────────────────────────────────────────────────

  @SubscribeMessage('read:mark')
  async handleReadMark(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() payload: { channelId?: string; dmId?: string; lastReadMessageId: string },
  ) {
    if (payload.channelId) {
      return this.readStateService.markChannelRead(payload.channelId, socket.data.user.sub, payload.lastReadMessageId);
    }
    if (payload.dmId) {
      return this.readStateService.markDmRead(payload.dmId, socket.data.user.sub, payload.lastReadMessageId);
    }
    throw new WsException('channelId or dmId is required');
  }
}
