'use client';

import { useState } from 'react';
import { MessageCircle, Phone, Video, Search, Send, Paperclip, Smile, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppContact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

interface WhatsAppMessage {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
}

// Mock data
const mockContacts: WhatsAppContact[] = [
  { id: '1', name: 'John Smith', lastMessage: 'Can we schedule a call?', time: '10:32 AM', unread: 2, online: true },
  { id: '2', name: 'Sarah Johnson', lastMessage: 'The report is ready', time: '9:15 AM', unread: 0, online: false },
  { id: '3', name: 'Team Marketing', lastMessage: 'Alex: New campaign launched!', time: 'Yesterday', unread: 5, online: true },
];

const mockMessages: WhatsAppMessage[] = [
  { id: '1', content: 'Hey, how\'s the project going?', time: '10:30 AM', sent: false, read: true },
  { id: '2', content: 'Going well! Just finished the analytics module.', time: '10:31 AM', sent: true, read: true },
  { id: '3', content: 'Can we schedule a call?', time: '10:32 AM', sent: false, read: true },
];

interface WhatsAppOverlayProps {
  connected: boolean;
  onConnect: () => void;
}

export function WhatsAppOverlay({ connected, onConnect }: WhatsAppOverlayProps) {
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connect WhatsApp</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Access your WhatsApp messages directly within KOSMOS. Stay focused without switching apps.
        </p>
        <button
          onClick={onConnect}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Connect with QR Code
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Uses WhatsApp Web protocol. Your messages stay encrypted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[500px]">
      {/* Contacts List */}
      <div className={cn("w-72 border-r border-white/[0.06] flex flex-col", selectedContact && "hidden md:flex")}>
        {/* Search */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {mockContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.04] transition-colors text-left",
                selectedContact?.id === contact.id && "bg-white/[0.06]"
              )}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
                  {contact.name.charAt(0)}
                </div>
                {contact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1a1a24]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">{contact.name}</span>
                  <span className="text-xs text-gray-500">{contact.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 truncate">{contact.lastMessage}</span>
                  {contact.unread > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded-full">
                      {contact.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden p-1 text-gray-400 hover:text-white"
                >
                  ←
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm">
                  {selectedContact.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{selectedContact.name}</div>
                  <div className="text-xs text-green-400">
                    {selectedContact.online ? 'online' : 'last seen recently'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                  <Video className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mockMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.sent ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[70%] px-3 py-2 rounded-xl",
                      msg.sent
                        ? "bg-green-600 text-white rounded-br-sm"
                        : "bg-white/[0.08] text-white rounded-bl-sm"
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] opacity-70">{msg.time}</span>
                      {msg.sent && (
                        msg.read ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 opacity-70" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  disabled={!message.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    message.trim()
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-white/[0.06] text-gray-500"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsAppOverlay;
