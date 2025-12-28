'use client';

import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export function CalendarCanvas() {
  const today = new Date();
  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
            <p className="text-gray-400 mt-1">Manage your schedule with Chronos</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <span className="text-white font-medium px-4">{monthName}</span>
              <button className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {/* Calendar Grid Placeholder */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8">
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-blue-400 opacity-50" />
            <h3 className="text-lg font-semibold text-white mb-2">Calendar Integration</h3>
            <p className="text-gray-400 mb-6">
              Connect your calendar to view and manage events
            </p>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Connect Google Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarCanvas;
