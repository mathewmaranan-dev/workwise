import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Info } from 'lucide-react';

export function SystemInfo() {
  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Info className="w-5 h-5" />
          System Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Version:</span>
          <span className="font-medium text-gray-900">1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Last Data Sync:</span>
          <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Environment:</span>
          <span className="font-medium text-gray-900">Production</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Data Range:</span>
          <span className="font-medium text-gray-900">Jan 1 - Feb 15, 2025</span>
        </div>
      </CardContent>
    </Card>
  );
}
