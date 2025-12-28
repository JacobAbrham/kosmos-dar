'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';

export default function SchedulePage() {
  const today = new Date();
  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <DashboardShell title="Schedule" subtitle="Manage your calendar with Chronos">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Schedule</h1>
              <p className="text-gray-400 mt-1">Manage your calendar and appointments</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <span className="text-gray-100 font-medium px-4">{monthName}</span>
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Calendar Placeholder */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Calendar Integration</h3>
            <p className="text-gray-400 mb-6">
              Connect your calendar to view and manage events with Chronos agent
            </p>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Connect Calendar
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
