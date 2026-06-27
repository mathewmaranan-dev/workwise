/**
 * EXACT CODE CHANGES FOR HR DASHBOARD
 * 
 * This file shows the exact lines to modify in HRDashboard.tsx
 * Search for each section and replace as indicated
 */

// ==========================================
// CHANGE 1: Add imports at the top
// ==========================================
// FIND (around line 1-20):
import { useAuth } from '../../context/AuthContext';

// ADD AFTER:
import { useTeamFilter } from '../../context/TeamFilterContext';
import { filterTicketsByTeam, calculateTeamKPIs } from '../../utils/teamFilterUtils';
import TeamFilter from '../../components/TeamFilter';


// ==========================================
// CHANGE 2: Add hook in component
// ==========================================
// FIND (around line 70):
const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

// ADD RIGHT AFTER:
const { selectedTeamId, selectedTeam } = useTeamFilter();


// ==========================================
// CHANGE 3: Update currentTickets calculation
// ==========================================
// FIND (around line 150-155):
const currentTickets = useMemo(() => {
  if (backendTicketsLoaded) return backendTickets;
  if (uploadedData && uploadedData.length > 0) return uploadedData;
  return [];
}, [backendTickets, backendTicketsLoaded, uploadedData]);

// REPLACE WITH:
const currentTickets = useMemo(() => {
  let tickets: any[] = [];
  
  if (backendTicketsLoaded) {
    tickets = backendTickets;
  } else if (uploadedData && uploadedData.length > 0) {
    tickets = uploadedData;
  } else {
    tickets = [];
  }
  
  // Apply team filter - this is the KEY CHANGE
  return filterTicketsByTeam(tickets, selectedTeamId);
}, [backendTickets, backendTicketsLoaded, uploadedData, selectedTeamId]);


// ==========================================
// CHANGE 4: Filter staffingSummary
// ==========================================
// FIND (around line 310):
const staffingSummary = performanceScores.map(group => {

// REPLACE WITH:
const staffingSummary = performanceScores
  .filter(group => selectedTeamId === null || group.groupId === selectedTeamId)
  .map(group => {


// ==========================================
// CHANGE 5: Update getCurrentStaffCount
// ==========================================
// FIND the getCurrentStaffCount function (around line 300):
const getCurrentStaffCount = (groupId: number, groupTickets: any[]) => {
  const dbUsersTableCount = Number(staffCountByGroup[groupId]);

// ADD after the function declaration, before other logic:
  // If team filter is active and doesn't match this group, return 0
  if (selectedTeamId !== null && groupId !== selectedTeamId) {
    return 0;
  }

// Then continue with the rest of the function


// ==========================================
// CHANGE 6: Filter topPerformers and underperformers
// ==========================================
// FIND:
const topPerformers = [...performanceScores]
  .sort((a, b) => b.overallScore - a.overallScore)
  .slice(0, 5);

const underperformers = [...performanceScores]
  .filter(g => g.overallScore < 75)
  .sort((a, b) => a.overallScore - b.overallScore);

// REPLACE WITH:
const filteredPerformanceScores = selectedTeamId === null
  ? performanceScores
  : performanceScores.filter(g => g.groupId === selectedTeamId);

const topPerformers = [...filteredPerformanceScores]
  .sort((a, b) => b.overallScore - a.overallScore)
  .slice(0, 5);

const underperformers = [...filteredPerformanceScores]
  .filter(g => g.overallScore < 75)
  .sort((a, b) => a.overallScore - b.overallScore);


// ==========================================
// CHANGE 7: Add TeamFilter UI to return JSX
// ==========================================
// FIND in the return statement (around line 900+):
return (
  <div className="space-y-6">

// REPLACE WITH:
return (
  <div className="space-y-6">
    {/* Team Filter Component - ADD THIS */}
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-3xl font-bold text-slate-900">
        HR & Senior Management Dashboard
        {selectedTeam !== 'All Teams' && (
          <span className="ml-2 text-xl text-indigo-600">— {selectedTeam}</span>
        )}
      </h1>
      <TeamFilter />
    </div>


// ==========================================
// CHANGE 8: Update page description when team is selected
// ==========================================
// FIND (around line 920):
<p className="text-slate-600 text-lg">Organizational performance, team health, and strategic insights</p>

// REPLACE WITH:
<p className="text-slate-600 text-lg">
  {selectedTeam === 'All Teams'
    ? 'Organizational performance, team health, and strategic insights'
    : `Performance analysis for ${selectedTeam}`}
</p>


// ==========================================
// SUMMARY OF CHANGES
// ==========================================
/*
Changes needed (in order):
1. Add 3 imports at top
2. Add hook to component
3. Update currentTickets useMemo to apply filterTicketsByTeam
4. Filter staffingSummary mapping with .filter()
5. Add check in getCurrentStaffCount
6. Filter performanceScores before creating topPerformers/underperformers
7. Add TeamFilter component to JSX
8. Update page title to show selected team

Total lines affected: ~15
Total lines added: ~20-30
Backwards compatible: YES (filtering still works with "All Teams" mode)
*/
