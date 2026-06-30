import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
// Middlewares
app.use(express.json());
app.use(cookieParser());

//Cors policy
app.use(cors({
  origin: 'http://localhost:3000', // Allows requests only from this specific origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods for the requests
  credentials: true // Set to true if you need to send cookies or authorization headers
}));

// --- Authentication Routes ---
import authRouter from './routes/auth/auth.js';
app.use('/api/auth', authRouter);

// Public routes


// --- Protected Routes ---
import profileRouter from './routes/profile/profile.js';
app.use('/api/profile', profileRouter);


// Server Configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`TS Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});