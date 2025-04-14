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
    
    // Get the origin from the request to use for CORS
    const origin = request.headers.get('origin') || '*';
    
    // Initialize Socket.IO server with proper CORS settings
    io = new Server(httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001', origin],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      path: '/api/socketio' // Add a path to avoid conflicts with Next.js API routes
    });
    
    // Setup Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Join a conversation
      socket.on('join-conversation', (data) => {
        if (data.conversationId) {
          socket.join(data.conversationId);
          console.log(`Socket ${socket.id} joined conversation ${data.conversationId}`);
        }
      });
      
      // Leave a conversation
      socket.on('leave-conversation', (data) => {
        if (data.conversationId) {
          socket.leave(data.conversationId);
          console.log(`Socket ${socket.id} left conversation ${data.conversationId}`);
        }
      });
      
      // Send a message to a conversation
      socket.on('send-message', (messageData) => {
        console.log(`Broadcasting message to conversation ${messageData.conversationId}`);
        io.to(messageData.conversationId).emit('new-message', messageData);
        
        // Also broadcast a general notification for unread count updates
        socket.broadcast.emit('new-message');
      });
      
      // Handle individual message being read
      socket.on('message-read', (data) => {
        console.log(`Message ${data.messageId} read by user ${data.userId}`);
        io.to(data.conversationId).emit('message-read', data);
        
        // Also broadcast a general notification for unread count updates
        io.emit('messages-read');
      });
      
      // Handle all messages in a conversation being read
      socket.on('messages-read', (data) => {
        console.log(`All messages in conversation ${data.conversationId} read by user ${data.userId}`);
        io.to(data.conversationId).emit('messages-read', data);
        
        // Also broadcast a general notification for unread count updates
        io.emit('messages-read');
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