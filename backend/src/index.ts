import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

import { getDb } from './database/db';
import authRoutes from './routes/auth';
import vendorRoutes from './routes/vendors';
import deviceRoutes from './routes/devices';
import childrenRoutes from './routes/children';
import messagesRoutes from './routes/messages';
import schedulesRoutes from './routes/schedules';
import wakeRoutes from './routes/wake';
import alertsRoutes from './routes/alerts';
import { setSocketIO } from './services/wake-scenario.service';
import { startScheduler } from './services/scheduling.service';
import { authenticateToken, AuthRequest } from './middleware/auth';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Pass socket.io to wake scenario service
setSocketIO(io);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
getDb();

// Serve uploaded audio files
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/auth', authRoutes);
app.use('/vendors', vendorRoutes);
app.use('/devices', deviceRoutes);
app.use('/children', childrenRoutes);
app.use('/children/:id/messages', messagesRoutes);
app.use('/children/:id/schedules', schedulesRoutes);
app.use('/messages', messagesRoutes);
app.use('/schedules', schedulesRoutes);
app.use('/wake', wakeRoutes);
app.use('/alerts', alertsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined room user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start the scheduler
startScheduler();

// Start server
server.listen(PORT, () => {
  console.log(`WakeBot backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
