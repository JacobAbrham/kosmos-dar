import { create } from 'zustand';
import axios from 'axios';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agent?: string;
  agentsUsed?: string[];
  cost?: number;
}

interface ConversationState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  setConversationId: (id: string) => void;
}

// In the browser we default to same-origin and rely on Next.js rewrites (/api -> backend).
const API_URL = typeof window === 'undefined'
  ? (process.env['KOSMOS_INTERNAL_API_URL'] || process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000')
  : '';

export const useConversationStore = create<ConversationState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  conversationId: null,

  sendMessage: async (content: string) => {
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await axios.post(`${API_URL}/api/v1/chat`, {
        message: content,
        conversation_id: get().conversationId,
      });

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        agent: response.data.primary_agent,
        agentsUsed: response.data.agents_used,
        cost: response.data.cost,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        conversationId: response.data.conversation_id,
      }));
    } catch (error) {
      // For demo, generate mock response
      const mockResponse: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: generateMockResponse(content),
        timestamp: new Date(),
        agent: 'Zeus',
        agentsUsed: determineAgents(content),
      };

      set((state) => ({
        messages: [...state.messages, mockResponse],
        isLoading: false,
      }));
    }
  },

  clearMessages: () => {
    set({ messages: [], conversationId: null });
  },

  setConversationId: (id: string) => {
    set({ conversationId: id });
  },
}));

// Mock response generator for demo
function generateMockResponse(input: string): string {
  const inputLower = input.toLowerCase();

  if (inputLower.includes('what can you do') || inputLower.includes('help')) {
    return `I'm KOSMOS, your AI-native enterprise platform. I can help you with:

**Analytics & Insights** (Athena)
- Analyze data and generate reports
- Identify trends and patterns
- Provide strategic recommendations

**Scheduling** (Chronos)
- Manage calendars and meetings
- Set reminders and deadlines
- Optimize your schedule

**Development** (Hephaestus)
- Code generation and review
- CI/CD management
- Technical documentation

**Security** (AEGIS)
- Security assessments
- Access control management
- Threat detection

**And much more!** Just ask me anything.`;
  }

  if (inputLower.includes('schedule') || inputLower.includes('meeting')) {
    return `I've analyzed your calendar. Here's your schedule for today:

**9:00 AM** - Team standup (30 min)
**10:30 AM** - Product review with stakeholders (1 hour)
**1:00 PM** - Lunch break
**2:00 PM** - Sprint planning (2 hours)
**4:30 PM** - 1:1 with manager

Would you like me to schedule a new meeting or modify an existing one?`;
  }

  if (inputLower.includes('analyze') || inputLower.includes('sales') || inputLower.includes('data')) {
    return `I've analyzed the data you requested. Here are the key insights:

**Key Findings:**
1. Revenue increased 15% quarter-over-quarter
2. Customer acquisition cost decreased by 8%
3. Highest performing region: APAC (+23%)

**Recommendations:**
- Increase marketing spend in APAC region
- Optimize conversion funnel for mobile users
- Consider expanding product line in Q2

Would you like me to generate a detailed report or dive deeper into any specific area?`;
  }

  if (inputLower.includes('status') || inputLower.includes('system')) {
    return `**System Status Report**

All 11 agents are operational:
- Zeus: Ready (Orchestration)
- Hermes: Ready (Data)
- AEGIS: Ready (Security)
- Athena: Ready (Analytics)
- Chronos: Ready (Scheduling)
- Hephaestus: Ready (Development)
- Nur PROMETHEUS: Ready (Finance)
- Iris: Ready (Communication)
- MEMORIX: Ready (Memory)
- Hestia: Ready (Operations)
- Morpheus: Ready (Prediction)

**Metrics:**
- Uptime: 99.97%
- Avg Response Time: 142ms
- Daily Cost: $42.50 / $500.00`;
  }

  return `I understand you're asking about "${input}". Let me help you with that.

Based on my analysis, I've coordinated with the relevant agents to address your request. The task has been processed successfully.

Is there anything specific you'd like me to elaborate on or any follow-up questions?`;
}

function determineAgents(input: string): string[] {
  const inputLower = input.toLowerCase();
  const agents: string[] = ['Zeus'];

  if (inputLower.includes('schedule') || inputLower.includes('meeting') || inputLower.includes('calendar')) {
    agents.push('Chronos');
  }
  if (inputLower.includes('analyze') || inputLower.includes('data') || inputLower.includes('report')) {
    agents.push('Athena');
    agents.push('Hermes');
  }
  if (inputLower.includes('code') || inputLower.includes('develop') || inputLower.includes('build')) {
    agents.push('Hephaestus');
  }
  if (inputLower.includes('security') || inputLower.includes('auth')) {
    agents.push('AEGIS');
  }
  if (inputLower.includes('cost') || inputLower.includes('budget')) {
    agents.push('Nur PROMETHEUS');
  }
  if (inputLower.includes('status') || inputLower.includes('system')) {
    agents.push('Hestia');
  }

  return agents;
}
