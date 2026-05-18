import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <div className="relative inline-flex">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">WORK-WISE</h2>
          <p className="text-gray-600 text-sm mt-1">Loading dashboard...</p>
        </div>
      </div>
    </div>
  );
}
