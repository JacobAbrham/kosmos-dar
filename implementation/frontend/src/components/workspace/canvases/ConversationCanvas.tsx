'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Sparkles, Send, Paperclip, Mic, Image as ImageIcon, FileText } from 'lucide-react';
import { useConversationStore, Message } from '@/stores/conversation';
import { useIntentDetection } from '@/hooks/useIntent';
import { cn } from '@/lib/utils';

export function ConversationCanvas() {
  const { messages, isLoading, sendMessage } = useConversationStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { processInput } = useIntentDetection();

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    // Process intent
    processInput(input);

    // Send message
    await sendMessage(input);
    setInput('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <WelcomeState onSuggestionClick={sendMessage} />
          ) : (
            <>
              <AnimatePresence>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </AnimatePresence>
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0d0d14]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-end gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3">
            {/* Attachment buttons */}
            <div className="flex items-center gap-1">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask KOSMOS anything..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none min-h-[24px] max-h-[150px]"
            />

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors">
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  input.trim() && !isLoading
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-white/[0.06] text-gray-500"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Try:</span>
            <QuickChip text="Analyze Q4 sales" onClick={sendMessage} />
            <QuickChip text="Schedule team meeting" onClick={sendMessage} />
            <QuickChip text="What can you do?" onClick={sendMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold mb-3">Welcome to KOSMOS</h1>
      <p className="text-gray-400 max-w-md mx-auto mb-8">
        Your unified workspace. Ask me anything, manage your work, or explore your data.
        I adapt to what you need.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
        <FeatureCard
          icon={<Bot className="w-5 h-5" />}
          title="11 AI Agents"
          description="Specialized assistants for every task"
        />
        <FeatureCard
          icon={<FileText className="w-5 h-5" />}
          title="Unified Inbox"
          description="WhatsApp, Slack, Email in one place"
        />
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          title="Intent-Aware"
          description="Interface adapts to your needs"
        />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap justify-center gap-2">
        <SuggestionChip text="What can you do?" onClick={onSuggestionClick} />
        <SuggestionChip text="Show me today's schedule" onClick={onSuggestionClick} />
        <SuggestionChip text="Analyze recent trends" onClick={onSuggestionClick} />
        <SuggestionChip text="Check system status" onClick={onSuggestionClick} />
      </div>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-left">
      <div className="text-indigo-400 mb-2">{icon}</div>
      <div className="font-medium text-white text-sm">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-full text-sm text-gray-300 hover:text-white transition-colors"
    >
      {text}
    </button>
  );
}

function QuickChip({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] rounded text-gray-400 hover:text-white transition-colors"
    >
      {text}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('flex gap-4', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-indigo-600' : 'bg-gradient-to-br from-yellow-500 to-orange-500'
        )}
      >
        {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div className={cn('flex items-center gap-2 mb-1', isUser && 'flex-row-reverse')}>
          <span className="text-sm font-medium text-white">
            {isUser ? 'You' : message.agent || 'Zeus'}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-indigo-600 text-white'
              : 'bg-white/[0.06] text-gray-100 border border-white/[0.06]'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Agent tags */}
        {!isUser && message.agentsUsed && message.agentsUsed.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-gray-500">Consulted:</span>
            {message.agentsUsed.map((agent) => (
              <span key={agent} className="px-2 py-0.5 bg-white/[0.04] rounded text-xs text-gray-400">
                {agent}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
        <Bot className="w-5 h-5 text-white" />
      </div>
      <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </motion.div>
  );
}

export default ConversationCanvas;
