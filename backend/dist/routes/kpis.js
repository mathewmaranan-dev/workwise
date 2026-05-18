import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
const router = Router();
// Get KPI dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        // Total tickets
        const totalTickets = await query('SELECT COUNT(*) as count FROM tickets');
        // Resolved tickets
        const resolvedTickets = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved'");
        // Average resolution time (in hours)
        const avgResolutionTime = await query(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as hours 
       FROM tickets WHERE resolved_at IS NOT NULL`);
        // SLA compliance
        const slaCompliance = await query(`SELECT 
        COUNT(CASE WHEN resolved_at <= sla_due_date THEN 1 END) * 100.0 / COUNT(*) as percentage
       FROM tickets WHERE resolved_at IS NOT NULL`);
        // Tickets by status
        const byStatus = await query(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`);
        // Tickets by priority
        const byPriority = await query(`SELECT p.priority_level, COUNT(*) as count 
       FROM tickets t
       JOIN priorities p ON t.priority_id = p.priority_id
       GROUP BY p.priority_level`);
        // Team performance (by assignment group)
        const teamPerformance = await query(`SELECT 
        ag.group_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) as avg_resolution_hours
       FROM tickets t
       JOIN assignment_groups ag ON t.assignment_group_id = ag.assignment_group_id
       GROUP BY ag.group_name`);
        res.json({
            totalTickets: totalTickets.rows[0],
            resolvedTickets: resolvedTickets.rows[0],
            avgResolutionTime: avgResolutionTime.rows[0],
            slaCompliance: slaCompliance.rows[0],
            byStatus: byStatus.rows,
            byPriority: byPriority.rows,
            teamPerformance: teamPerformance.rows,
        });
    }
    catch (error) {
        console.error('Get KPI dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch KPI data' });
    }
});
// Get team performance metrics
router.get('/team/:groupId', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const result = await query(`SELECT 
        u.id,
        u.first_name,
        u.last_name,
        COUNT(t.ticket_id) as total_tickets,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) as avg_resolution_hours,
        SUM(CASE WHEN t.resolved_at <= t.sla_due_date THEN 1 ELSE 0 END) as sla_met
       FROM users u
       LEFT JOIN tickets t ON u.id = t.assigned_to
       WHERE u.assignment_group_id = $1
       GROUP BY u.id, u.first_name, u.last_name`, [groupId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Get team performance error:', error);
        res.status(500).json({ error: 'Failed to fetch team metrics' });
    }
});
export default router;
//# sourceMappingURL=kpis.js.map