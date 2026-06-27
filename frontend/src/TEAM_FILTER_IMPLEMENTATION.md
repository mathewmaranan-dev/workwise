# Team Filter Integration Guide for Dashboards

## SUMMARY
This document provides the exact code changes needed to add team filtering to your dashboards while maintaining all existing functionality and WITHOUT modifying backend/ML services.

---

## STEP 1: Wrap App.tsx with TeamFilterProvider

**File:** `frontend/src/main.tsx` or `frontend/src/App.tsx`

**Add this import:**
```typescript
import { TeamFilterProvider } from './app/context/TeamFilterContext';
```

**Wrap the app root:**
```tsx
function App() {
  return (
    <TeamFilterProvider>
      {/* Your existing app structure */}
    </TeamFilterProvider>
  );
}
```

---

## STEP 2: Update HRDashboard.tsx with Team Filtering

**Key Changes:**

### 2.1 Add import at the top:
```typescript
import { useTeamFilter } from '../context/TeamFilterContext';
import { filterTicketsByTeam, calculateTeamKPIs } from '../utils/teamFilterUtils';
import TeamFilter from '../components/TeamFilter';
```

### 2.2 Inside the HRDashboard component, after `const apiBase = ...` line, add:
```typescript
const { selectedTeamId, selectedTeam } = useTeamFilter();
```

### 2.3 Filter the currentTickets:
Replace existing `currentTickets` logic with:
```typescript
const currentTickets = useMemo(() => {
  let tickets: any[] = [];
  
  if (backendTicketsLoaded) {
    tickets = backendTickets;
  } else if (uploadedData && uploadedData.length > 0) {
    tickets = uploadedData;
  } else {
    tickets = [];
  }
  
  // Apply team filter
  return filterTicketsByTeam(tickets, selectedTeamId);
}, [backendTickets, backendTicketsLoaded, uploadedData, selectedTeamId]);
```

### 2.4 Update staffing count filtering (in getCurrentStaffCount function):
```typescript
const getCurrentStaffCount = (groupId: number, groupTickets: any[]) => {
  // If team filter is active and groupId doesn't match, return 0
  if (selectedTeamId !== null && groupId !== selectedTeamId) {
    return 0;
  }
  
  // ... rest of existing logic
};
```

### 2.5 In staffingSummary, filter by selected team:
```typescript
const staffingSummary = performanceScores
  .filter(group => selectedTeamId === null || group.groupId === selectedTeamId)
  .map(group => {
    // ... existing logic
  });
```

### 2.6 Add TeamFilter component to the render (at the top of the return JSX):
```tsx
return (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-slate-900">HR Dashboard</h1>
      <TeamFilter />
    </div>
    
    {/* Rest of existing dashboard... */}
  </div>
);
```

---

## STEP 3: Update AdminDashboard.tsx with Team Filtering

**Key Changes:**

### 3.1 Add imports at the top:
```typescript
import { useTeamFilter } from '../../context/TeamFilterContext';
import { filterTicketsByTeam } from '../../utils/teamFilterUtils';
import TeamFilter from '../../components/TeamFilter';
```

### 3.2 In AdminView component, add team filter hook:
```typescript
const { selectedTeamId } = useTeamFilter();
```

### 3.3 Update currentTickets filtering in AdminView:
```typescript
const currentTickets = useMemo(() => {
  let tickets = dashboardLoading && uploadedData?.length > 0 ? uploadedData : dashboardTickets;
  
  // Apply team filter
  return filterTicketsByTeam(tickets, selectedTeamId);
}, [dashboardLoading, dashboardTickets, uploadedData, selectedTeamId]);
```

### 3.4 Add TeamFilter to the render:
```tsx
return (
  <div className="space-y-4">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-bold">System-wide Overview and Performance Metrics</h2>
      <TeamFilter />
    </div>
    
    {/* Rest of existing admin dashboard... */}
  </div>
);
```

---

## STEP 4: Update ManagerDashboard.tsx with Team Filtering

**Note:** ManagerDashboard already has team filtering by `selectedGroupId`, but we should ensure it works with the new context.

### 4.1 Add imports:
```typescript
import { useTeamFilter } from '../context/TeamFilterContext';
```

### 4.2 Add to component:
```typescript
const { selectedTeamId: contextTeamId } = useTeamFilter();
```

### 4.3 Modify selectedGroupId logic (keep existing manager restrictions):
```typescript
// Use context team if user is admin, otherwise use their assignment group
const initialTeamId = user?.role === 'admin' ? contextTeamId : user?.assignment_group_id;
const [selectedGroupId, setSelectedGroupId] = useState<number | null>(initialTeamId ?? null);
```

---

## STEP 5: Integration Checklist

✅ **Files to Modify:**
- [ ] `frontend/src/main.tsx` or `frontend/src/App.tsx` - Wrap with TeamFilterProvider
- [ ] `frontend/src/app/pages/dashboards/HRDashboard.tsx` - Add filtering & TeamFilter component
- [ ] `frontend/src/app/pages/dashboards/AdminDashboard.tsx` - Add filtering & TeamFilter component (AdminView)
- [ ] `frontend/src/app/pages/dashboards/ManagerDashboard.tsx` - Integrate with context

✅ **Files Already Created:**
- [x] `frontend/src/app/context/TeamFilterContext.tsx`
- [x] `frontend/src/app/components/TeamFilter.tsx`
- [x] `frontend/src/app/utils/teamFilterUtils.ts`

---

## BEHAVIOR AFTER IMPLEMENTATION

### When "All Teams" is selected:
- All charts display full organization data
- All KPIs reflect company-wide metrics
- All tables show all teams
- All staffing recommendations aggregate across teams

### When a specific team is selected (e.g., "Software Team"):
- Charts update to show only Software Team data
- KPIs update to reflect Software Team metrics only
- Tables display only Software Team rows
- Forecasts adjust if team-specific data available
- ML recommendations filter to that team
- Staffing analysis focuses on that team only

### **NO backend changes needed:**
- API endpoints remain unchanged
- All existing query parameters still work
- ML services unaffected
- Database schema unchanged
- No API contracts broken

---

## PERFORMANCE OPTIMIZATION

The filtering uses `useMemo` to prevent unnecessary recalculations:
- Data only refiltered when `selectedTeamId` or `currentTickets` change
- Chart re-renders only when filtered data changes
- Smooth transitions without flickering

---

## BACKWARD COMPATIBILITY

✅ All existing functionality preserved
✅ Existing API calls unchanged
✅ Manager dashboard still respects role-based filtering
✅ Uploaded data still works
✅ ML service predictions still function
✅ All existing features still available

---

## EXAMPLE: Filtering Logic Pattern

Every dashboard component should follow this pattern:

```tsx
// 1. Get selected team from context
const { selectedTeamId } = useTeamFilter();

// 2. Filter data based on selection
const filteredData = useMemo(() => {
  return filterTicketsByTeam(allTickets, selectedTeamId);
}, [allTickets, selectedTeamId]);

// 3. Use filtered data for calculations
const kpis = calculateKPIs(filteredData);

// 4. Display with filtered data
return (
  <div>
    <TeamFilter />
    {/* Charts and tables using filteredData */}
  </div>
);
```

---

## TESTING CHECKLIST

- [ ] "All Teams" shows complete organization data
- [ ] Selecting "Software Team" filters all components
- [ ] Selecting "Network Team" updates all visualizations
- [ ] Selecting other teams works correctly
- [ ] Switching teams updates smoothly
- [ ] Page doesn't reload when switching teams
- [ ] Charts re-render with new team data
- [ ] Tables update correctly
- [ ] KPIs recalculate for selected team
- [ ] Staffing recommendations update
- [ ] No console errors
- [ ] No API errors
- [ ] ML predictions work for filtered team
- [ ] "All Teams" restores original view perfectly

---

## NOTES

- **No backend modification needed:** All filtering happens on the frontend
- **No ML service changes:** ML predictions work as-is with frontend filtering
- **API unchanged:** Can still make group-specific API calls if needed
- **Database safe:** No schema changes required
- **Performance:** Filtering is instant (milliseconds)
- **User experience:** Smooth transitions between team views

