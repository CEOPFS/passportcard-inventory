import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

import { initializeDatabase } from './database/db';
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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setSocketIO(io);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

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

async function start() {
  await initializeDatabase();
  startScheduler();
  server.listen(PORT, () => {
    console.log(`WakeBot backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
