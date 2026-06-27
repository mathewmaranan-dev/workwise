import React, { createContext, useContext, useState, ReactNode } from 'react';
import { assignmentGroups } from '../data/seedData';

export interface TeamFilterContextType {
  selectedTeam: string; // "All Teams" or group_name like "Software Team"
  selectedTeamId: number | null; // null for "All Teams", otherwise group_id
  setSelectedTeam: (teamName: string) => void;
  setSelectedTeamId: (teamId: number | null) => void;
  teams: typeof assignmentGroups;
}

const TeamFilterContext = createContext<TeamFilterContextType | undefined>(undefined);

export const TeamFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedTeam, setSelectedTeam] = useState<string>('All Teams');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const value: TeamFilterContextType = {
    selectedTeam,
    selectedTeamId,
    setSelectedTeam: (teamName: string) => {
      setSelectedTeam(teamName);
      if (teamName === 'All Teams') {
        setSelectedTeamId(null);
      } else {
        const team = assignmentGroups.find(g => g.group_name === teamName);
        if (team) {
          setSelectedTeamId(team.assignment_group_id);
        }
      }
    },
    setSelectedTeamId: (teamId: number | null) => {
      setSelectedTeamId(teamId);
      if (teamId === null) {
        setSelectedTeam('All Teams');
      } else {
        const team = assignmentGroups.find(g => g.assignment_group_id === teamId);
        if (team) {
          setSelectedTeam(team.group_name);
        }
      }
    },
    teams: assignmentGroups,
  };

  return (
    <TeamFilterContext.Provider value={value}>
      {children}
    </TeamFilterContext.Provider>
  );
};

export const useTeamFilter = (): TeamFilterContextType => {
  const context = useContext(TeamFilterContext);
  if (!context) {
    throw new Error('useTeamFilter must be used within TeamFilterProvider');
  }
  return context;
};
