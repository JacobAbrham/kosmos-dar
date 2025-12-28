'use client';

import { Book, MessageCircle, ExternalLink, Zap } from 'lucide-react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';

export default function HelpPage() {
  return (
    <DashboardShell title="Help" subtitle="Support and documentation">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-100">Help & Support</h1>
            <p className="text-gray-400 mt-1">Get help with KOSMOS and learn how to use the platform</p>
          </div>

          {/* Quick Start */}
          <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">Quick Start Guide</h3>
                <p className="text-gray-400 mb-4">
                  New to KOSMOS? Learn the basics of working with AI agents and get up to speed quickly.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Start Tutorial
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Help Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Book className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100">Documentation</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Comprehensive guides and API reference for KOSMOS platform.
              </p>
              <a
                href="https://docs.nuvanta-holding.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                View Docs
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100">Ask KOSMOS</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Have a question? Just ask KOSMOS directly from the main interface.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
              >
                Go to Chat
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Agent Guide */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Meet Your Agents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="font-medium text-gray-100">Zeus</span>
                </div>
                <p className="text-sm text-gray-400">Master orchestrator - coordinates all agents</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="font-medium text-gray-100">Athena</span>
                </div>
                <p className="text-sm text-gray-400">Analytics and strategic insights</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium text-gray-100">Chronos</span>
                </div>
                <p className="text-sm text-gray-400">Scheduling and calendar management</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="font-medium text-gray-100">Hephaestus</span>
                </div>
                <p className="text-sm text-gray-400">Code generation and development</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
