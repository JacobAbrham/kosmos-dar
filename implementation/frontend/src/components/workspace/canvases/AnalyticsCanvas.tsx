'use client';

import { BarChart3, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { GlassCard } from '@/components/glass';

export function AnalyticsCanvas() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Track performance and insights across your organization</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Revenue"
            value="$124,500"
            change="+12.5%"
            trend="up"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Active Users"
            value="2,847"
            change="+8.2%"
            trend="up"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Tasks Completed"
            value="1,284"
            change="+24.1%"
            trend="up"
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard
            title="Agent Utilization"
            value="87%"
            change="+5.3%"
            trend="up"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard title="Task Activity" icon={<BarChart3 className="w-5 h-5" />}>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Chart visualization coming soon</p>
                <p className="text-sm mt-1">Connect data sources to see analytics</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Agent Performance" icon={<Activity className="w-5 h-5" />}>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Performance metrics coming soon</p>
                <p className="text-sm mt-1">Real-time agent monitoring</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon 
}: { 
  title: string; 
  value: string; 
  change: string; 
  trend: 'up' | 'down'; 
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{title}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className={`text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
        {change} from last month
      </div>
    </div>
  );
}

export default AnalyticsCanvas;
