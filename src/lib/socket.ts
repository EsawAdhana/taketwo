import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
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
      console.log('Client connected');

      socket.on('join-conversation', (conversationId: string) => {
        socket.join(conversationId);
      });

      socket.on('leave-conversation', (conversationId: string) => {
        socket.leave(conversationId);
      });

      socket.on('send-message', async (data: {
        content: string;
        senderId: string;
        receiverId: string;
        conversationId: string;
      }) => {
        try {
          await connectDB();
          
          const message = await Message.create({
            content: data.content,
            senderId: data.senderId,
            receiverId: data.receiverId,
            conversationId: data.conversationId,
          });

          // Update conversation's last message
          await Conversation.findByIdAndUpdate(data.conversationId, {
            lastMessage: message._id,
          });

          // Emit the message to both users
          io.to(data.conversationId).emit('new-message', message);
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', 'Failed to send message');
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  }
  return res.socket.server.io;
}; 