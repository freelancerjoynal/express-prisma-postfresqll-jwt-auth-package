import express from 'express';
import { 
  signup, 
  verifyOTP, 
  login, 
  refresh, 
  logout, 
  forgotPassword, 
  resetPassword,
  verifyLoginOTP 
} from '../../controllers/authController.js';

const authRouter = express.Router();

authRouter.post('/signup', signup);
authRouter.post('/verify', verifyOTP); // This now verifies and logs in instantly
authRouter.post('/login', login);
authRouter.post('/verify-login-otp', verifyLoginOTP)
authRouter.post('/refresh-token', refresh);
authRouter.post('/logout', logout);




// Password Reset routes
authRouter.post('/forgot-password', forgotPassword); // Sends OTP
authRouter.post('/reset-password', resetPassword);   // Verifies OTP & sends new password


export default authRouter;