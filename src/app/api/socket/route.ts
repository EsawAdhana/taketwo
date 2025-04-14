import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Prevent multiple instances during hot reloading in development
let io: Server;

export async function GET(request: NextRequest) {
  // Check if socket server already exists
  if (io) {
    return NextResponse.json({
      success: true,
      message: 'Socket.IO server is already running'
    });
  }
  
  try {
    // Create a simple HTTP server
    const httpServer = createServer();
    
    // Initialize Socket.IO server
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    // Setup Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Join a conversation
      socket.on('join-conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
      });
      
      // Leave a conversation
      socket.on('leave-conversation', (conversationId) => {
        socket.leave(conversationId);
        console.log(`Socket ${socket.id} left conversation ${conversationId}`);
      });
      
      // Send a message to a conversation
      socket.on('send-message', (messageData) => {
        console.log(`Broadcasting message to conversation ${messageData.conversationId}`);
        io.to(messageData.conversationId).emit('new-message', messageData);
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
    
    // Listen on an available port
    const PORT = process.env.SOCKET_PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Socket.IO server running on port ${PORT}`);
    });
    
    return NextResponse.json({
      success: true,
      message: `Socket.IO server initialized on port ${PORT}`
    });
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize Socket.IO server'
    }, { status: 500 });
  }
} 