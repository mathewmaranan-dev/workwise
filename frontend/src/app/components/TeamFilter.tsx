import React from 'react';
import { useTeamFilter } from '../context/TeamFilterContext';
import { Button } from './ui/button';
import { ChevronDown } from 'lucide-react';

interface TeamFilterProps {
  className?: string;
}

export const TeamFilter: React.FC<TeamFilterProps> = ({ className = '' }) => {
  const { selectedTeam, setSelectedTeam, teams } = useTeamFilter();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelectTeam = (teamName: string) => {
    setSelectedTeam(teamName);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-slate-600">Filter by Team:</span>
        <div className="relative">
          <Button
            onClick={() => setIsOpen(!isOpen)}
            variant="outline"
            className="flex items-center gap-2 bg-white hover:bg-slate-50"
          >
            <span className="font-medium">{selectedTeam}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>

          {isOpen && (
            <div className="absolute z-50 mt-2 w-max min-w-52 bg-white border border-slate-200 rounded-lg shadow-lg">
              {/* All Teams Option */}
              <button
                onClick={() => handleSelectTeam('All Teams')}
                className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors first:rounded-t-lg ${
                  selectedTeam === 'All Teams'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-slate-700'
                }`}
              >
                All Teams
              </button>

              {/* Team Options */}
              {teams.map((team, index) => (
                <button
                  key={team.assignment_group_id}
                  onClick={() => handleSelectTeam(team.group_name)}
                  className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors ${
                    index === teams.length - 1 ? 'rounded-b-lg' : ''
                  } ${
                    selectedTeam === team.group_name
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  {team.group_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default TeamFilter;
