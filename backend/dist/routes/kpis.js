import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getDashboardMetrics, getTeamPerformance } from '../services/kpiService.js';
const router = Router();
// Get KPI dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const metrics = await getDashboardMetrics();
        res.json(metrics);
    }
    catch (error) {
        console.error('Get KPI dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch KPI data' });
    }
});
// Get team performance metrics
router.get('/team/:groupId', verifyToken, async (req, res) => {
    try {
        const metrics = await getTeamPerformance(req.params.groupId);
        res.json(metrics);
    }
    catch (error) {
        console.error('Get team performance error:', error);
        res.status(500).json({ error: 'Failed to fetch team metrics' });
    }
});
export default router;
//# sourceMappingURL=kpis.js.map