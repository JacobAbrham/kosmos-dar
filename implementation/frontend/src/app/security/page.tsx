'use client';

import { Shield, AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';

export default function SecurityPage() {
  return (
    <DashboardShell title="Security" subtitle="Monitor with AEGIS">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Security</h1>
              <p className="text-gray-400 mt-1">Monitor security status and manage access with AEGIS</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
              <Shield className="w-4 h-4" />
              Run Security Scan
            </button>
          </div>

          {/* Security Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Status</span>
              </div>
              <div className="text-lg font-bold text-green-400">Secure</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Warnings</span>
              </div>
              <div className="text-lg font-bold text-yellow-400">0</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <span className="text-sm text-gray-400">Access Rules</span>
              </div>
              <div className="text-lg font-bold text-indigo-400">0</div>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-red-400" />
                <span className="text-sm text-gray-400">Last Scan</span>
              </div>
              <div className="text-lg font-bold text-gray-400">Never</div>
            </div>
          </div>

          {/* Security Features */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Security Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
                <Shield className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-100">AEGIS Guardian</div>
                  <div className="text-sm text-gray-400">AI-powered security monitoring and threat detection</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
                <Lock className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-100">Access Control</div>
                  <div className="text-sm text-gray-400">Role-based permissions and authentication</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
