import { query } from '../config/database.js';
export async function getDashboardMetrics() {
    const totalTickets = await query('SELECT COUNT(*) as count FROM tickets');
    const resolvedTickets = await query("SELECT COUNT(*) as count FROM tickets WHERE status_id = (SELECT status_id FROM status WHERE status_name = 'Resolved')");
    const fcrRate = await query(`SELECT 
        COUNT(CASE WHEN fcr = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as percentage
       FROM tickets WHERE resolved_date IS NOT NULL`);
    const avgResolutionTime = await query(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_date - created_date))/3600) as hours 
       FROM tickets WHERE resolved_date IS NOT NULL`);
    const slaCompliance = await query(`SELECT 
        COUNT(CASE WHEN resolved_date <= sla_duedate THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as percentage
       FROM tickets WHERE resolved_date IS NOT NULL`);
    const byStatus = await query(`SELECT s.status_name as status, COUNT(*) as count FROM tickets t
       LEFT JOIN status s ON t.status_id = s.status_id
       GROUP BY s.status_name`);
    const byPriority = await query(`SELECT p.priority_level, COUNT(*) as count 
       FROM tickets t
       JOIN priority p ON t.priority_id = p.priority_id
       GROUP BY p.priority_level`);
    return {
        totalTickets: totalTickets.rows[0],
        resolvedTickets: resolvedTickets.rows[0],
        fcrRate: fcrRate.rows[0],
        avgResolutionTime: avgResolutionTime.rows[0],
        slaCompliance: slaCompliance.rows[0],
        byStatus: byStatus.rows,
        byPriority: byPriority.rows,
    };
}
export async function getTeamPerformance(groupId) {
    const teamPerformance = await query(`SELECT 
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
    return teamPerformance.rows;
}
//# sourceMappingURL=kpiService.js.map