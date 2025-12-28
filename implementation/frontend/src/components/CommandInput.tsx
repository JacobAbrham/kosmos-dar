'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, Sparkles } from 'lucide-react';
import { useConversationStore } from '@/stores/conversation';

export function CommandInput() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useConversationStore();

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await sendMessage(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="glassmorphism p-3">
      <div className="flex items-end gap-3">
        {/* Attachment button */}
        <button className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Input area */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask KOSMOS anything... (Enter to send, Shift+Enter for new line)"
            className="command-input resize-none min-h-[44px] max-h-[200px] pr-12"
            rows={1}
            disabled={isProcessing}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        {/* Voice input */}
        <button className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors">
          <Mic className="w-5 h-5" />
        </button>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>Try:</span>
        <QuickAction text="Analyze Q4 sales data" />
        <QuickAction text="Schedule team meeting" />
        <QuickAction text="Review security audit" />
      </div>
    </div>
  );
}

function QuickAction({ text }: { text: string }) {
  const { sendMessage } = useConversationStore();

  return (
    <button
      onClick={() => sendMessage(text)}
      className="px-2 py-1 bg-gray-800/50 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-100 transition-colors"
    >
      {text}
    </button>
  );
}
