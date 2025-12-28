'use client';

import { Cpu, Activity, Server, HardDrive, RefreshCw } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';

export default function OperationsPage() {
  return (
    <DashboardShell title="Operations" subtitle="System monitoring with Hestia">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Operations</h1>
              <p className="text-gray-400 mt-1">System health and infrastructure monitoring with Hestia</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white font-medium rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh Status
            </button>
          </div>

          {/* System Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-lime-400" />
                <span className="text-sm text-gray-400">CPU Usage</span>
              </div>
              <div className="text-2xl font-bold text-lime-400">--</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-5 h-5 text-lime-400" />
                <span className="text-sm text-gray-400">Memory</span>
              </div>
              <div className="text-2xl font-bold text-lime-400">--</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-lime-400" />
                <span className="text-sm text-gray-400">Services</span>
              </div>
              <div className="text-2xl font-bold text-lime-400">--</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-lime-400" />
                <span className="text-sm text-gray-400">Uptime</span>
              </div>
              <div className="text-2xl font-bold text-lime-400">--</div>
            </div>
          </div>

          {/* Services Status */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Service Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-100">Backend API</span>
                </div>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-100">PostgreSQL</span>
                </div>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-100">Redis</span>
                </div>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-100">WebSocket</span>
                </div>
                <span className="text-sm text-gray-400">Not connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
