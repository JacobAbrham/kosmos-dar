'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Sparkles } from 'lucide-react';
import { useConversationStore, Message } from '@/stores/conversation';
import { cn } from '@/lib/utils';

export function ConversationView() {
  const { messages, isLoading } = useConversationStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Welcome message */}
      {messages.length === 0 && <WelcomeMessage />}

      {/* Messages */}
      <AnimatePresence>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      {isLoading && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Welcome to KOSMOS</h2>
      <p className="text-gray-400 max-w-md mx-auto">
        Your AI-native enterprise platform. Ask me anything about your data,
        schedule meetings, analyze reports, or manage your workflows.
      </p>

      {/* Quick start suggestions */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <SuggestionChip text="What can you do?" />
        <SuggestionChip text="Show me today's schedule" />
        <SuggestionChip text="Analyze sales trends" />
        <SuggestionChip text="Check system status" />
      </div>
    </div>
  );
}

function SuggestionChip({ text }: { text: string }) {
  const { sendMessage } = useConversationStore();

  return (
    <button
      onClick={() => sendMessage(text)}
      className="px-4 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-full text-sm text-gray-300 hover:text-white transition-colors"
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
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-indigo-600' : 'bg-gray-700'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 max-w-[80%]',
          isUser && 'flex flex-col items-end'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 mb-1',
            isUser && 'flex-row-reverse'
          )}
        >
          <span className="text-sm font-medium">
            {isUser ? 'You' : message.agent || 'KOSMOS'}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-xl px-4 py-2',
            isUser
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-100'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Agent indicators */}
        {!isUser && message.agentsUsed && message.agentsUsed.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-gray-500">Used:</span>
            {message.agentsUsed.map((agent) => (
              <span
                key={agent}
                className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400"
              >
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
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-800 rounded-xl px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}
