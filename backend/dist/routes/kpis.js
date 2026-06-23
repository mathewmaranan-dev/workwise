import { Router } from 'express';
import { query } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import { getAllTicketsAnalytics, getAllTicketsAnalyticsWithSummary } from '../services/ticketService.js';
const router = Router();
// Get KPI dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        // Total tickets
        const totalTickets = await query('SELECT COUNT(*) as count FROM tickets');
        // Resolved tickets
        const resolvedTickets = await query("SELECT COUNT(*) as count FROM tickets WHERE status_id = (SELECT status_id FROM status WHERE status_name = 'Resolved')");
        // FCR Rate
        const fcrRate = await query(`SELECT 
        COUNT(CASE WHEN fcr = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as percentage
       FROM tickets WHERE resolved_date IS NOT NULL`);
        // Average resolution time (in hours)
        const avgResolutionTime = await query(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_date - created_date))/3600) as hours 
       FROM tickets WHERE resolved_date IS NOT NULL`);
        // SLA compliance
        const slaCompliance = await query(`SELECT 
        COUNT(CASE WHEN resolved_date <= sla_duedate THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as percentage
       FROM tickets WHERE resolved_date IS NOT NULL`);
        // Tickets by status
        const byStatus = await query(`SELECT s.status_name as status, COUNT(*) as count FROM tickets t
       LEFT JOIN status s ON t.status_id = s.status_id
       GROUP BY s.status_name`);
        // Tickets by priority
        const byPriority = await query(`SELECT p.priority_id, p.priority_level, COUNT(*) as count 
       FROM tickets t
       JOIN priority p ON t.priority_id = p.priority_id
       GROUP BY p.priority_id, p.priority_level
       ORDER BY p.priority_id`);
        // Team performance (by assignment group)
        const teamPerformance = await query(`SELECT 
        ag.group_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status_id = (SELECT status_id FROM status WHERE status_name = 'Resolved') THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN t.fcr = true THEN 1 ELSE 0 END) as fcr_count,
        AVG(EXTRACT(EPOCH FROM (t.resolved_date - t.created_date))/3600) as avg_resolution_hours,
        SUM(CASE WHEN t.made_sla = true THEN 1 ELSE 0 END) as sla_met
       FROM tickets t
       JOIN assignment_groups ag ON t.assignment_group_id = ag.assignment_group_id
       GROUP BY ag.group_name`);
        res.json({
            totalTickets: totalTickets.rows[0],
            resolvedTickets: resolvedTickets.rows[0],
            fcrRate: fcrRate.rows[0],
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
router.get('/dashboard/tickets', verifyToken, async (req, res) => {
    try {
        const filters = {
            ticket_id: String(req.query.ticket_id || ''),
            assigned_to_id: String(req.query.assigned_to_id || req.query.assigned_to || ''),
            assignment_group_id: String(req.query.assignment_group_id || ''),
            category_id: String(req.query.category_id || ''),
            status_id: String(req.query.status_id || ''),
            status: String(req.query.status || ''),
            priority_id: String(req.query.priority_id || req.query.priority || ''),
            created_from: String(req.query.created_from || ''),
            created_to: String(req.query.created_to || ''),
            limit: String(req.query.limit || '20000'),
            offset: String(req.query.offset || '0'),
        };
        if (String(req.query.includeSummary || '').toLowerCase() === 'true') {
            const result = await getAllTicketsAnalyticsWithSummary(filters);
            return res.json(result);
        }
        const tickets = await getAllTicketsAnalytics(filters);
        res.json(tickets);
    }
    catch (error) {
        console.error('Get KPI dashboard tickets error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard ticket analytics' });
    }
});
// Get team performance metrics
router.get('/team/:groupId', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const result = await query(`SELECT 
        u.user_id as id,
        u.first_name,
        u.last_name,
        COUNT(t.ticket_id) as total_tickets,
        SUM(CASE WHEN t.status_id = (SELECT status_id FROM status WHERE status_name = 'Resolved') THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.fcr = true THEN 1 ELSE 0 END) as fcr_count,
        AVG(EXTRACT(EPOCH FROM (t.resolved_date - t.created_date))/3600) as avg_resolution_hours,
        SUM(CASE WHEN t.made_sla = true THEN 1 ELSE 0 END) as sla_met
       FROM users u
       LEFT JOIN tickets t ON u.user_id = t.assigned_to_id
       WHERE u.assignment_group_id = $1
       GROUP BY u.user_id, u.first_name, u.last_name`, [groupId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Get team performance error:', error);
        res.status(500).json({ error: 'Failed to fetch team metrics' });
    }
});
export default router;
// Aggregated Non-FCR by category and agent for a team
router.get('/team/:groupId/nonfcr', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        // Query tickets for the team grouped by category and agent
        const rows = await query(`SELECT category_id, assigned_to_id, COUNT(*) as total_tickets,
         SUM(CASE WHEN fcr = true THEN 1 ELSE 0 END) as fcr_count,
         array_agg(ticket_id ORDER BY created_date DESC) as ticket_ids
       FROM tickets
       WHERE assignment_group_id = $1
       GROUP BY category_id, assigned_to_id`, [groupId]);
        // Aggregate category totals to compute category-level FCR rates
        const categoryTotals = {};
        rows.rows.forEach((r) => {
            const cid = Number(r.category_id) || 0;
            if (!categoryTotals[cid])
                categoryTotals[cid] = { total: 0, fcr: 0 };
            categoryTotals[cid].total += Number(r.total_tickets || 0);
            categoryTotals[cid].fcr += Number(r.fcr_count || 0);
        });
        // Build response rows with rates, ticketIds and recommended action
        const out = rows.rows.map((r) => {
            const categoryId = Number(r.category_id) || 0;
            const agentId = r.assigned_to_id ? Number(r.assigned_to_id) : null;
            const total = Number(r.total_tickets || 0);
            const fcr = Number(r.fcr_count || 0);
            const category = categoryTotals[categoryId] || { total: 0, fcr: 0 };
            const categoryFCRRate = category.total > 0 ? (category.fcr / category.total) * 100 : 0;
            const agentCategoryFCRRate = total > 0 ? (fcr / total) * 100 : 0;
            let action = 'No Risk: retain assignment';
            if (categoryFCRRate < 40 && agentCategoryFCRRate === 0) {
                action = 'Dual Alert: retrain agent and escalate systemic fixes';
            }
            else if (categoryFCRRate < 40) {
                action = 'Systemic Category Issue: everyone struggles, process fix needed';
            }
            else if (agentCategoryFCRRate < categoryFCRRate - 20) {
                action = 'Agent Skill Gap: training/coaching needed';
            }
            return {
                categoryId,
                agentId,
                categoryFCRRate: Number(categoryFCRRate.toFixed(2)),
                agentCategoryFCRRate: Number(agentCategoryFCRRate.toFixed(2)),
                totalTickets: total,
                ticketIds: Array.isArray(r.ticket_ids) ? r.ticket_ids : [],
                action,
            };
        });
        res.json(out);
    }
    catch (error) {
        console.error('Get team non-FCR aggregated error:', error);
        res.status(500).json({ error: 'Failed to fetch non-FCR aggregated data' });
    }
});
//# sourceMappingURL=kpis.js.map