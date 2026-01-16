'use client';

/**
 * KOSMOS AEOS Settings Page
 * System configuration and preferences
 */

import React, { useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { useSDUIContext } from '@/context/SDUIContext';
import { MFASetup } from '@/components/auth/MFASetup';
import { Settings, Bot, Shield, Bell, Link2, Wrench } from 'lucide-react';

type SettingsTab = 'general' | 'agents' | 'security' | 'notifications' | 'integrations' | 'advanced';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { globalState, setTheme } = useSDUIContext();
  const [settings, setSettings] = useState({
    systemName: 'KOSMOS AEOS',
    timezone: 'UTC',
    language: 'en',
    theme: globalState.theme,
    defaultModel: 'claude-3-opus',
    maxConcurrentTasks: 10,
    defaultTimeout: 300,
    autoApprove: false,
    mfaEnabled: false,
    sessionTimeout: 60,
    ipWhitelist: '',
    auditLogging: true,
    emailNotifications: true,
    slackNotifications: false,
    notifyOnError: true,
    notifyOnApproval: true,
    slackWebhook: '',
    githubToken: '',
    jiraUrl: '',
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'advanced', label: 'Advanced', icon: Wrench },
  ];

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setSettings((prev) => ({ ...prev, theme: newTheme }));
    setTheme(newTheme);
  };

  return (
    <DashboardShell title="Settings" subtitle="Configure your KOSMOS AEOS system">
      <div className="p-6">
        {/* Save Button */}
        <div className="flex justify-end mb-6">
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-400 flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                      ${activeTab === tab.id
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'}
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">General Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">System Name</label>
                      <input
                        type="text"
                        value={settings.systemName}
                        onChange={(e) => setSettings((prev) => ({ ...prev, systemName: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Theme</label>
                      <div className="flex gap-3">
                        {(['light', 'dark', 'system'] as const).map((theme) => (
                          <button
                            key={theme}
                            onClick={() => handleThemeChange(theme)}
                            className={`
                              flex-1 py-3 rounded-lg border-2 transition-all capitalize text-gray-100
                              ${settings.theme === theme
                                ? 'border-indigo-500 bg-indigo-500/20'
                                : 'border-gray-700 hover:border-gray-600'}
                            `}
                          >
                            {theme === 'light' && '☀️ '}
                            {theme === 'dark' && '🌙 '}
                            {theme === 'system' && '💻 '}
                            {theme}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
                        <select
                          value={settings.timezone}
                          onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                          className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                          <option value="Europe/London">London</option>
                          <option value="Asia/Dubai">Dubai</option>
                          <option value="Asia/Tokyo">Tokyo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Language</label>
                        <select
                          value={settings.language}
                          onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
                          className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                        >
                          <option value="en">English</option>
                          <option value="ar">Arabic</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Agents Settings */}
              {activeTab === 'agents' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">Agent Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Default AI Model</label>
                      <select
                        value={settings.defaultModel}
                        onChange={(e) => setSettings((prev) => ({ ...prev, defaultModel: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                      >
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                        <option value="gpt-4">GPT-4</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Max Concurrent Tasks</label>
                        <input
                          type="number"
                          value={settings.maxConcurrentTasks}
                          onChange={(e) => setSettings((prev) => ({ ...prev, maxConcurrentTasks: parseInt(e.target.value) }))}
                          min={1}
                          max={50}
                          className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Default Timeout (seconds)</label>
                        <input
                          type="number"
                          value={settings.defaultTimeout}
                          onChange={(e) => setSettings((prev) => ({ ...prev, defaultTimeout: parseInt(e.target.value) }))}
                          min={30}
                          max={3600}
                          className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                        />
                      </div>
                    </div>
                    <ToggleSetting
                      label="Auto-approve Low Risk Actions"
                      description="Automatically approve actions below a certain risk threshold"
                      checked={settings.autoApprove}
                      onChange={() => setSettings((prev) => ({ ...prev, autoApprove: !prev.autoApprove }))}
                    />
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">Security Settings</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-100">Multi-Factor Authentication</p>
                          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                        </div>
                        <button
                          onClick={() => setSettings((prev) => ({ ...prev, mfaEnabled: !prev.mfaEnabled }))}
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            ${settings.mfaEnabled ? 'bg-indigo-500' : 'bg-gray-600'}
                          `}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                              ${settings.mfaEnabled ? 'translate-x-6' : 'translate-x-1'}
                            `}
                          />
                        </button>
                      </div>
                      {!settings.mfaEnabled && (
                        <button
                          onClick={() => setSettings((prev) => ({ ...prev, mfaEnabled: true }))}
                          className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Set Up MFA
                        </button>
                      )}
                      {settings.mfaEnabled && (
                        <div className="mt-4">
                          <MFASetup
                            onComplete={() => {
                              setSettings((prev) => ({ ...prev, mfaEnabled: true }));
                            }}
                            onCancel={() => {
                              setSettings((prev) => ({ ...prev, mfaEnabled: false }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => setSettings((prev) => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                        min={5}
                        max={480}
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100"
                      />
                    </div>
                    <ToggleSetting
                      label="Audit Logging"
                      description="Log all system actions for compliance"
                      checked={settings.auditLogging}
                      onChange={() => setSettings((prev) => ({ ...prev, auditLogging: !prev.auditLogging }))}
                    />
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">Notification Settings</h2>
                  <div className="space-y-4">
                    <ToggleSetting
                      label="Email Notifications"
                      description="Receive notifications via email"
                      checked={settings.emailNotifications}
                      onChange={() => setSettings((prev) => ({ ...prev, emailNotifications: !prev.emailNotifications }))}
                    />
                    <ToggleSetting
                      label="Slack Notifications"
                      description="Receive notifications in Slack"
                      checked={settings.slackNotifications}
                      onChange={() => setSettings((prev) => ({ ...prev, slackNotifications: !prev.slackNotifications }))}
                    />
                    <ToggleSetting
                      label="Error Alerts"
                      description="Get notified when tasks fail"
                      checked={settings.notifyOnError}
                      onChange={() => setSettings((prev) => ({ ...prev, notifyOnError: !prev.notifyOnError }))}
                    />
                    <ToggleSetting
                      label="Approval Requests"
                      description="Get notified when approval is needed"
                      checked={settings.notifyOnApproval}
                      onChange={() => setSettings((prev) => ({ ...prev, notifyOnApproval: !prev.notifyOnApproval }))}
                    />
                  </div>
                </div>
              )}

              {/* Integrations Settings */}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">Integrations</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Slack Webhook URL</label>
                      <input
                        type="url"
                        value={settings.slackWebhook}
                        onChange={(e) => setSettings((prev) => ({ ...prev, slackWebhook: e.target.value }))}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">GitHub Token</label>
                      <input
                        type="password"
                        value={settings.githubToken}
                        onChange={(e) => setSettings((prev) => ({ ...prev, githubToken: e.target.value }))}
                        placeholder="ghp_..."
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Jira URL</label>
                      <input
                        type="url"
                        value={settings.jiraUrl}
                        onChange={(e) => setSettings((prev) => ({ ...prev, jiraUrl: e.target.value }))}
                        placeholder="https://your-company.atlassian.net"
                        className="w-full px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Settings */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-100">Advanced Settings</h2>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="font-medium text-yellow-400">Warning: Advanced Settings</p>
                    <p className="text-sm text-yellow-400/80 mt-1">
                      These settings can affect system stability. Modify with caution.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <button className="w-full p-4 text-left border border-gray-700 rounded-lg hover:bg-gray-800">
                      <p className="font-medium text-gray-100">Export Configuration</p>
                      <p className="text-sm text-gray-500">Download current settings as JSON</p>
                    </button>
                    <button className="w-full p-4 text-left border border-gray-700 rounded-lg hover:bg-gray-800">
                      <p className="font-medium text-gray-100">Import Configuration</p>
                      <p className="text-sm text-gray-500">Upload settings from JSON file</p>
                    </button>
                    <button className="w-full p-4 text-left border border-red-500/30 rounded-lg hover:bg-red-500/10">
                      <p className="font-medium text-red-400">Reset to Defaults</p>
                      <p className="text-sm text-red-400/70">Reset all settings to their default values</p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
      <div>
        <p className="font-medium text-gray-100">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-indigo-500' : 'bg-gray-600'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
