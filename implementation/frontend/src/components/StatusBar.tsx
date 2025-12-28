'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, DollarSign, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemMetrics {
  activeUsers: number;
  agentsReady: number;
  totalAgents: number;
  dailyCost: number;
  dailyBudget: number;
  requestsPerMinute: number;
}

async function fetchMetrics(): Promise<SystemMetrics> {
  // In production, fetch from API
  return {
    activeUsers: 127,
    agentsReady: 11,
    totalAgents: 11,
    dailyCost: 42.50,
    dailyBudget: 500,
    requestsPerMinute: 342,
  };
}

export function StatusBar() {
  const { data: metrics } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!metrics) return null;

  return (
    <div className="flex items-center gap-6 text-sm">
      <StatusItem
        icon={Users}
        label="Users"
        value={metrics.activeUsers.toString()}
        color="text-blue-400"
      />

      <StatusItem
        icon={Cpu}
        label="Agents"
        value={`${metrics.agentsReady}/${metrics.totalAgents}`}
        color={metrics.agentsReady === metrics.totalAgents ? 'text-green-400' : 'text-yellow-400'}
      />

      <StatusItem
        icon={DollarSign}
        label="Daily Cost"
        value={`$${metrics.dailyCost.toFixed(2)}`}
        subValue={`/ $${metrics.dailyBudget}`}
        color={metrics.dailyCost / metrics.dailyBudget > 0.8 ? 'text-yellow-400' : 'text-green-400'}
      />

      <StatusItem
        icon={Activity}
        label="Requests"
        value={`${metrics.requestsPerMinute}/min`}
        color="text-purple-400"
      />
    </div>
  );
}

interface StatusItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}

function StatusItem({ icon: Icon, label, value, subValue, color }: StatusItemProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-4 h-4', color)} />
      <div>
        <div className="text-gray-400 text-xs">{label}</div>
        <div className="font-medium">
          <span className={color}>{value}</span>
          {subValue && <span className="text-gray-500">{subValue}</span>}
        </div>
      </div>
    </div>
  );
}
