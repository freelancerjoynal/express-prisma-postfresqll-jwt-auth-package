import express from 'express';
import { authenticated } from '../../../middleware/authMiddleware.js';
import { authorize } from '../../../middleware/roleMiddleware.js';


const adminDashboardRouter = express.Router();

adminDashboardRouter.get('/', authenticated, authorize('ADMIN'), (req, res) => {
  res.json({ message: 'Welcome to the Admin Dashboard' });
});

export default adminDashboardRouter;