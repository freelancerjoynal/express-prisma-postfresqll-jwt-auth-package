import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { sendOTPEmail, sendNewPasswordEmail } from '../utils/mailer.js';
import { prisma } from '../lib/prisma.js';

// ১. টোকেন জেনারেশন ফাংশন
const generateTokens = (userId: string | number, role: string) => {
  const accessToken = jwt.sign(
    { userId, role }, 
    process.env.JWT_ACCESS_SECRET!, 
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role }, 
    process.env.JWT_REFRESH_SECRET!, 
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

// ২. ইউজার রেজিস্ট্রেশন
export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.create({
      data: { 
        email, 
        password: hashedPassword, 
        otp, 
        otpExpiry,
        role: 'USER'
      }
    });

    await sendOTPEmail(email, otp);
    res.status(201).json({ message: 'Signup success! OTP sent to your email.' });
  } catch (error: any) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// ৩. রেজিস্ট্রেশন ওটিপি ভেরিফিকেশন
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await prisma.user.update({
      where: { email },
      data: { 
        isVerified: true, 
        otp: null, 
        otpExpiry: null,
        refreshToken: refreshToken 
      }
    });

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Verified successfully!', role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ৪. লগইন (ধাপ ১: ওটিপি পাঠানো)
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(String(password), user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    // লগইন ওটিপি জেনারেশন
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiry }
    });

    await sendOTPEmail(email, otp);
    res.json({ message: 'Login OTP sent to your email.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ৫. লগইন ওটিপি ভেরিফিকেশন (ধাপ ২: টোকেন ইস্যু)
export const verifyLoginOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    
    await prisma.user.update({ 
      where: { id: user.id }, 
      data: { otp: null, otpExpiry: null, refreshToken } 
    });

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Login successful', role: user.role, email: user.email, name: user.name, accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ৬. ফরগেট পাসওয়ার্ড
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

// ৭. রিসেট পাসওয়ার্ড
export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const newRawPassword = crypto.randomBytes(4).toString('hex'); 
    const hashedNewPassword = await bcrypt.hash(newRawPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { 
        password: hashedNewPassword, 
        otp: null, 
        otpExpiry: null 
      }
    });

    await sendNewPasswordEmail(email, newRawPassword);
    res.json({ message: 'A new password has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ৮. রিফ্রেশ টোকেন
export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) return res.status(403).json({ error: 'Invalid refresh token' });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    });

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Token refreshed', role: user.role });
  } catch (err) {
    res.status(403).json({ error: 'Session expired' });
  }
};

// ৯. লগআউট
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