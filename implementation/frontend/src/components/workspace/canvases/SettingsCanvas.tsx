'use client';

import { useState } from 'react';
import { Settings, User, Bell, Shield, Palette, Plug, Bot, Moon, Sun, Monitor } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'integrations' | 'agents' | 'notifications' | 'security';

export function SettingsCanvas() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { workspaceMode, setWorkspaceMode, integrations } = useWorkspaceStore();

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Configure your KOSMOS workspace</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'general' && (
            <>
              <SettingsSection title="Appearance">
                <SettingRow
                  label="Theme"
                  description="Choose your preferred color scheme"
                >
                  <div className="flex gap-2">
                    <ThemeButton icon={<Sun className="w-4 h-4" />} label="Light" active={false} />
                    <ThemeButton icon={<Moon className="w-4 h-4" />} label="Dark" active={true} />
                    <ThemeButton icon={<Monitor className="w-4 h-4" />} label="System" active={false} />
                  </div>
                </SettingRow>
              </SettingsSection>

              <SettingsSection title="Workspace Mode">
                <SettingRow
                  label="Default Mode"
                  description="How the workspace should behave"
                >
                  <select
                    value={workspaceMode}
                    onChange={(e) => setWorkspaceMode(e.target.value as typeof workspaceMode)}
                    className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="default">Default</option>
                    <option value="focus">Focus Mode</option>
                    <option value="communication">Communication</option>
                    <option value="analysis">Analysis</option>
                    <option value="development">Development</option>
                  </select>
                </SettingRow>
              </SettingsSection>
            </>
          )}

          {activeTab === 'integrations' && (
            <SettingsSection title="Connected Services">
              {integrations.map((integration) => (
                <SettingRow
                  key={integration.id}
                  label={integration.name}
                  description={integration.connected ? 'Connected' : 'Not connected'}
                >
                  <button
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-colors",
                      integration.connected
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                    )}
                  >
                    {integration.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </SettingRow>
              ))}
            </SettingsSection>
          )}

          {activeTab === 'agents' && (
            <SettingsSection title="Agent Configuration">
              <div className="text-center py-8 text-gray-400">
                Agent configuration coming soon
              </div>
            </SettingsSection>
          )}

          {activeTab === 'notifications' && (
            <SettingsSection title="Notification Preferences">
              <SettingRow
                label="Desktop Notifications"
                description="Show system notifications"
              >
                <Toggle enabled={true} />
              </SettingRow>
              <SettingRow
                label="Sound"
                description="Play sounds for notifications"
              >
                <Toggle enabled={false} />
              </SettingRow>
            </SettingsSection>
          )}

          {activeTab === 'security' && (
            <SettingsSection title="Security Settings">
              <SettingRow
                label="Two-Factor Authentication"
                description="Add an extra layer of security"
              >
                <button className="px-4 py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-sm transition-colors">
                  Enable
                </button>
              </SettingRow>
            </SettingsSection>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </div>
  );
}

function SettingRow({ 
  label, 
  description, 
  children 
}: { 
  label: string; 
  description: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div>
        <div className="text-white font-medium">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      {children}
    </div>
  );
}

function ThemeButton({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
        active
          ? "bg-indigo-500/20 text-indigo-400"
          : "bg-white/[0.04] text-gray-400 hover:text-white"
      )}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <button
      className={cn(
        "w-12 h-6 rounded-full transition-colors relative",
        enabled ? "bg-indigo-600" : "bg-gray-600"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform",
          enabled ? "translate-x-6" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export default SettingsCanvas;
