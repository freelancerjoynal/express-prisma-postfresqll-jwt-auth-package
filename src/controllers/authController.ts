import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { sendOTPEmail, sendNewPasswordEmail } from '../utils/mailer.js';
import { prisma } from '../lib/prisma.js';

// Helper function to generate access and refresh tokens
const generateTokens = (userId: number) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// 1. User Registration
export const signup = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 mins

    await prisma.user.create({
      data: { email, password: hashedPassword, otp, otpExpiry }
    });

    await sendOTPEmail(email, otp);
    res.status(201).json({ message: 'Signup success! Verification OTP sent to your email.' });
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
};

// 2. Verify OTP and Automatic Login
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Validate OTP and Expiry
    if (!user || user.otp !== otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Update user: Verify and save refresh token
    await prisma.user.update({
      where: { email },
      data: { 
        isVerified: true, 
        otp: null, 
        otpExpiry: null,
        refreshToken: refreshToken 
      }
    });

    // Set HTTP-Only Cookies
    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Verified and logged in successfully!', accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. Standard Login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If not verified, send new OTP and block login
    if (!user.isVerified) {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { email },
        data: { otp: newOtp, otpExpiry: new Date(Date.now() + 10 * 60 * 1000) }
      });
      await sendOTPEmail(email, newOtp);
      return res.status(403).json({ error: 'Email not verified. New OTP sent.' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Login successful', accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. Forget Password - Send OTP
export const forgotPassword = async (req: Request, res: Response) => { 
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otp, otpExpiry }
    });

    await sendOTPEmail(email, otp);
    res.json({ message: 'Reset OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. Reset Password - Verify OTP and send new generated password
export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Generate a secure random password
    const newRawPassword = crypto.randomBytes(4).toString('hex'); // 8 characters
    const hashedNewPassword = await bcrypt.hash(newRawPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { 
        password: hashedNewPassword, 
        otp: null, 
        otpExpiry: null 
      }
    });

    // Send the new password to user's email
    await sendNewPasswordEmail(email, newRawPassword);

    res.json({ message: 'A new password has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 6. Refresh Access Token
export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) return res.status(403).json({ error: 'Invalid refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };
    const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });

    res.cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.json({ message: 'Token refreshed', accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: 'Session expired' });
  }
};

// 7. Logout
export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await prisma.user.updateMany({
      where: { refreshToken },
      data: { refreshToken: null }
    });
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};