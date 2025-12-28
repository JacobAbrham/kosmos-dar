'use client';

import { useState } from 'react';
import { Hash, Plus, Search, Send, AtSign, Smile, Paperclip, MoreHorizontal, MessageSquare, Bell, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  unread: number;
  mentions: number;
}

interface SlackDM {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
  unread: number;
}

interface SlackMessage {
  id: string;
  user: string;
  avatar?: string;
  content: string;
  time: string;
  reactions?: { emoji: string; count: number }[];
}

// Mock data
const mockChannels: SlackChannel[] = [
  { id: '1', name: 'general', isPrivate: false, unread: 3, mentions: 1 },
  { id: '2', name: 'engineering', isPrivate: false, unread: 12, mentions: 0 },
  { id: '3', name: 'design-team', isPrivate: true, unread: 0, mentions: 0 },
  { id: '4', name: 'product', isPrivate: false, unread: 5, mentions: 2 },
];

const mockDMs: SlackDM[] = [
  { id: '1', name: 'Sarah Chen', online: true, unread: 2 },
  { id: '2', name: 'Mike Rodriguez', online: true, unread: 0 },
  { id: '3', name: 'Emma Wilson', online: false, unread: 0 },
];

const mockMessages: SlackMessage[] = [
  {
    id: '1',
    user: 'Sarah Chen',
    content: 'Hey team! The new deployment is live 🚀',
    time: '10:30 AM',
    reactions: [{ emoji: '🎉', count: 5 }, { emoji: '🚀', count: 3 }],
  },
  {
    id: '2',
    user: 'Mike Rodriguez',
    content: 'Great work everyone! The metrics are looking good.',
    time: '10:32 AM',
  },
  {
    id: '3',
    user: 'You',
    content: 'Thanks! Let me know if you need any help with the rollout.',
    time: '10:35 AM',
  },
];

interface SlackOverlayProps {
  connected: boolean;
  onConnect: () => void;
}

export function SlackOverlay({ connected, onConnect }: SlackOverlayProps) {
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(mockChannels[0]);
  const [message, setMessage] = useState('');
  const [showChannels, setShowChannels] = useState(true);
  const [showDMs, setShowDMs] = useState(true);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
        <div className="w-16 h-16 rounded-xl bg-[#4A154B]/30 flex items-center justify-center mb-4">
          <Hash className="w-8 h-8 text-[#E01E5A]" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connect Slack</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Access all your Slack workspaces and channels directly within KOSMOS.
        </p>
        <button
          onClick={onConnect}
          className="px-6 py-2 bg-[#4A154B] hover:bg-[#5B1D5C] text-white rounded-lg transition-colors"
        >
          Add to Slack
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Requires workspace admin approval
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[500px]">
      {/* Sidebar */}
      <div className="w-56 bg-[#1a1a24] border-r border-white/[0.06] flex flex-col">
        {/* Workspace Header */}
        <div className="px-3 py-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Nuvanta</span>
            <button className="p-1 text-gray-400 hover:text-white">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels Section */}
          <div className="px-2 mb-2">
            <button
              onClick={() => setShowChannels(!showChannels)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white w-full"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", !showChannels && "-rotate-90")} />
              Channels
            </button>
            {showChannels && (
              <div className="mt-1 space-y-0.5">
                {mockChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors",
                      selectedChannel?.id === channel.id
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span className="truncate flex-1 text-left">{channel.name}</span>
                    {channel.unread > 0 && (
                      <span className={cn(
                        "text-[10px] px-1.5 rounded-full",
                        channel.mentions > 0 ? "bg-red-500 text-white" : "bg-gray-600 text-gray-200"
                      )}>
                        {channel.mentions > 0 ? `@${channel.mentions}` : channel.unread}
                      </span>
                    )}
                  </button>
                ))}
                <button className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Add channel
                </button>
              </div>
            )}
          </div>

          {/* DMs Section */}
          <div className="px-2">
            <button
              onClick={() => setShowDMs(!showDMs)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white w-full"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", !showDMs && "-rotate-90")} />
              Direct Messages
            </button>
            {showDMs && (
              <div className="mt-1 space-y-0.5">
                {mockDMs.map((dm) => (
                  <button
                    key={dm.id}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="relative">
                      <div className="w-5 h-5 rounded bg-gray-600 flex items-center justify-center text-[10px] text-white">
                        {dm.name.charAt(0)}
                      </div>
                      {dm.online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[#1a1a24]" />
                      )}
                    </div>
                    <span className="truncate flex-1 text-left">{dm.name}</span>
                    {dm.unread > 0 && (
                      <span className="text-[10px] px-1.5 bg-red-500 text-white rounded-full">
                        {dm.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-white">{selectedChannel?.name || 'general'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mockMessages.map((msg) => (
            <div key={msg.id} className="flex gap-3 group hover:bg-white/[0.02] -mx-4 px-4 py-1 rounded">
              <div className="w-9 h-9 rounded bg-gray-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                {msg.user.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-white text-sm">{msg.user}</span>
                  <span className="text-xs text-gray-500">{msg.time}</span>
                </div>
                <p className="text-sm text-gray-200 mt-0.5">{msg.content}</p>
                {msg.reactions && (
                  <div className="flex gap-1 mt-2">
                    {msg.reactions.map((reaction, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] rounded-full text-xs"
                      >
                        {reaction.emoji} {reaction.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
            <button className="p-1 text-gray-400 hover:text-white transition-colors">
              <Plus className="w-5 h-5" />
            </button>
            <input
              type="text"
              placeholder={`Message #${selectedChannel?.name || 'general'}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
            />
            <button className="p-1 text-gray-400 hover:text-white transition-colors">
              <AtSign className="w-5 h-5" />
            </button>
            <button className="p-1 text-gray-400 hover:text-white transition-colors">
              <Smile className="w-5 h-5" />
            </button>
            <button
              disabled={!message.trim()}
              className={cn(
                "p-1 rounded transition-colors",
                message.trim() ? "text-indigo-400 hover:text-indigo-300" : "text-gray-500"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SlackOverlay;
