import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000', // Your Next.js origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Crucial for Clerk
}));

// --- Authentication Routes ---
import authRouter from './routes/auth/auth.js';
app.use('/api/auth', authRouter);

// Public routes


// --- Protected Routes ---
import profileRouter from './routes/profile/profileRouter.js';
app.use('/api/auth/profile', profileRouter);

// Admin Dashboard Routes
import adminDashboardRouter from './routes/dashboard/admin/adminDashboardRouter.js';
app.use('/api/admin/dashboard', adminDashboardRouter);


// Server Configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`TS Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});