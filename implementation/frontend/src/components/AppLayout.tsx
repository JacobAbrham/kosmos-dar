'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
}

export function AppLayout({ 
  children, 
  showHeader = true,
  headerTitle = 'KOSMOS',
  headerSubtitle = 'AI-Native Enterprise Platform'
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        {showHeader && (
          <header className="glassmorphism m-2 p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {headerTitle}
              </h1>
              <span className="text-sm text-gray-500">{headerSubtitle}</span>
            </div>
            <div className="flex items-center gap-4">
              <StatusBar />
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
