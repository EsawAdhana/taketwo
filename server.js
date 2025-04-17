const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { getToken } = require('next-auth/jwt');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO server with CORS configuration
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Create a middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      // Skip authentication if no token (will restrict features later)
      if (!token) {
        return next();
      }
      
      // Manually create a mock request object with the token cookie
      const req = {
        headers: {
          cookie: `next-auth.session-token=${token}`
        }
      };
      
      // Verify the token using NextAuth's getToken
      const user = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      
      if (user) {
        // Attach user data to the socket
        socket.user = user;
        next();
      } else {
        next(new Error('Authentication error'));
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    
    // Join user to their specific rooms (conversations)
    socket.on('join-conversations', (conversations) => {
      if (Array.isArray(conversations)) {
        conversations.forEach(conversationId => {
          socket.join(`conversation:${conversationId}`);
        });
      }
    });
    
    // Handle new message 
    socket.on('send-message', (message) => {
      // Broadcast message to the specific conversation room
      io.to(`conversation:${message.conversationId}`).emit('new-message', message);
      // Also emit a general event for the conversation list to update
      io.emit('conversation-update', {
        _id: message.conversationId,
        lastMessage: message
      });
    });
    
    // Handle message seen
    socket.on('mark-read', (data) => {
      io.to(`conversation:${data.conversationId}`).emit('message-read', data);
    });
    
    // Handle joining a specific conversation
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });
    
    // Handle leaving a specific conversation
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });
    
    // Handle conversation deletion
    socket.on('delete-conversation', (conversationId) => {
      io.emit('conversation-deleted', conversationId);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
}); 