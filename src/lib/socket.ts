import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import connectDB from './mongodb';

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

export const initSocket = (res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      socket.on('join-conversation', (conversationId: string) => {
        socket.join(conversationId);
      });

      socket.on('leave-conversation', (conversationId: string) => {
        socket.leave(conversationId);
      });

      socket.on('send-message', async (messageData) => {
        const session = await getSession({ req: socket.request as any });
        if (!session?.user) {
          socket.emit('error', 'Unauthorized');
          return;
        }

        // Broadcast the message to all users in the conversation
        io.to(messageData.conversationId).emit('new-message', messageData);
      });

      socket.on('mark-as-read', async (data: { conversationId: string; messageId: string }) => {
        const session = await getSession({ req: socket.request as any });
        if (!session?.user) {
          socket.emit('error', 'Unauthorized');
          return;
        }

        // Notify other participants that the message was read
        socket.to(data.conversationId).emit('message-read', {
          messageId: data.messageId,
          userId: session.user.id
        });
      });

      socket.on('disconnect', () => {
      });
    });
  }
  return res.socket.server.io;
}; 