import { useCallback, useMemo } from 'react';
import { useWorkspaceStore, IntentCategory, CanvasType } from '@/stores/workspace';

// ============================================================================
// INTENT PATTERNS
// ============================================================================

interface IntentPattern {
  category: IntentCategory;
  keywords: string[];
  patterns: RegExp[];
  canvas: CanvasType;
  priority: number;
}

const intentPatterns: IntentPattern[] = [
  {
    category: 'communication',
    keywords: ['message', 'reply', 'send', 'whatsapp', 'slack', 'email', 'call', 'chat', 'dm', 'text'],
    patterns: [
      /^(message|msg|dm|text)\s+/i,
      /@\w+/,
      /reply\s+to/i,
      /send\s+(a\s+)?(message|email|dm)/i,
      /^(wa|whatsapp|slack|email|mail)\b/i,
    ],
    canvas: 'conversation',
    priority: 80,
  },
  {
    category: 'analysis',
    keywords: ['analyze', 'report', 'chart', 'graph', 'data', 'metrics', 'dashboard', 'trends', 'statistics', 'insights'],
    patterns: [
      /analyze\s+/i,
      /show\s+(me\s+)?(the\s+)?(data|metrics|stats|analytics)/i,
      /\b(q[1-4]|quarterly|monthly|weekly|daily)\s+(report|data|numbers)/i,
      /what\s+(are|were)\s+(the\s+)?(numbers|metrics|stats)/i,
    ],
    canvas: 'analytics',
    priority: 70,
  },
  {
    category: 'scheduling',
    keywords: ['schedule', 'meeting', 'calendar', 'appointment', 'book', 'event', 'remind', 'when', 'availability'],
    patterns: [
      /schedule\s+(a\s+)?/i,
      /(book|set\s+up)\s+(a\s+)?(meeting|call|appointment)/i,
      /when\s+(is|are|can|should)/i,
      /add\s+to\s+(my\s+)?calendar/i,
      /(tomorrow|today|next\s+(week|month|monday|tuesday|wednesday|thursday|friday))/i,
    ],
    canvas: 'calendar',
    priority: 75,
  },
  {
    category: 'development',
    keywords: ['code', 'bug', 'deploy', 'build', 'test', 'commit', 'push', 'pull', 'merge', 'branch', 'debug', 'fix'],
    patterns: [
      /\b(code|debug|deploy|build|test)\b/i,
      /fix\s+(the\s+)?bug/i,
      /(git|npm|yarn|docker)\s+/i,
      /create\s+(a\s+)?(component|function|api|endpoint)/i,
    ],
    canvas: 'editor',
    priority: 65,
  },
  {
    category: 'documentation',
    keywords: ['document', 'write', 'draft', 'note', 'doc', 'wiki', 'readme', 'spec', 'proposal'],
    patterns: [
      /write\s+(a\s+)?(document|doc|draft|proposal)/i,
      /create\s+(a\s+)?(note|document|spec)/i,
      /update\s+(the\s+)?(docs|documentation|readme)/i,
    ],
    canvas: 'editor',
    priority: 60,
  },
  {
    category: 'operations',
    keywords: ['status', 'health', 'logs', 'monitor', 'deploy', 'restart', 'scale', 'metrics', 'alert'],
    patterns: [
      /(system|server|service)\s+status/i,
      /check\s+(the\s+)?(health|logs|status)/i,
      /what('s|\s+is)\s+(running|down|failing)/i,
    ],
    canvas: 'analytics',
    priority: 55,
  },
  {
    category: 'navigation',
    keywords: ['go', 'open', 'show', 'navigate', 'switch', 'view'],
    patterns: [
      /^(go|open|show|view)\s+/i,
      /switch\s+to/i,
      /take\s+me\s+to/i,
    ],
    canvas: 'conversation',
    priority: 50,
  },
  {
    category: 'conversation',
    keywords: [], // Default fallback
    patterns: [],
    canvas: 'conversation',
    priority: 0,
  },
];

// ============================================================================
// INTENT DETECTION
// ============================================================================

interface DetectedIntent {
  category: IntentCategory;
  confidence: number;
  suggestedCanvas: CanvasType;
  extractedEntities: {
    mentions: string[];
    dates: string[];
    keywords: string[];
  };
}

function detectIntent(input: string): DetectedIntent {
  const normalizedInput = input.toLowerCase().trim();
  let bestMatch: IntentPattern = intentPatterns[intentPatterns.length - 1]; // Default to conversation
  let highestScore = 0;

  // Extract entities
  const mentions = input.match(/@\w+/g) || [];
  const dates = input.match(/\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/gi) || [];
  const extractedKeywords: string[] = [];

  for (const pattern of intentPatterns) {
    let score = 0;

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalizedInput.includes(keyword)) {
        score += 10;
        extractedKeywords.push(keyword);
      }
    }

    // Check patterns
    for (const regex of pattern.patterns) {
      if (regex.test(normalizedInput)) {
        score += 25;
      }
    }

    // Apply priority as tiebreaker
    score += pattern.priority * 0.1;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = pattern;
    }
  }

  // Calculate confidence (0-1)
  const maxPossibleScore = bestMatch.keywords.length * 10 + bestMatch.patterns.length * 25 + bestMatch.priority * 0.1;
  const confidence = maxPossibleScore > 0 ? Math.min(highestScore / maxPossibleScore, 1) : 0.5;

  return {
    category: bestMatch.category,
    confidence,
    suggestedCanvas: bestMatch.canvas,
    extractedEntities: {
      mentions,
      dates,
      keywords: [...new Set(extractedKeywords)],
    },
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useIntentDetection() {
  const { 
    activeIntent, 
    setActiveIntent, 
    activeCanvas,
    setActiveCanvas,
    openOverlay,
    closeAllOverlays,
  } = useWorkspaceStore();

  const processInput = useCallback((input: string) => {
    const result = detectIntent(input);
    
    // Update intent if confidence is high enough
    if (result.confidence > 0.3) {
      setActiveIntent(result.category);
      
      // Auto-switch canvas for high confidence intents
      if (result.confidence > 0.6 && result.suggestedCanvas !== activeCanvas) {
        setActiveCanvas(result.suggestedCanvas);
      }
    }

    return result;
  }, [activeCanvas, setActiveIntent, setActiveCanvas]);

  const suggestActions = useCallback((intent: DetectedIntent) => {
    const actions: { label: string; action: () => void }[] = [];

    switch (intent.category) {
      case 'communication':
        if (intent.extractedEntities.mentions.length > 0) {
          actions.push({
            label: `Message ${intent.extractedEntities.mentions[0]}`,
            action: () => openOverlay({ type: 'quick-reply', position: 'right', size: 'md' }),
          });
        }
        actions.push({
          label: 'Open Messages',
          action: () => openOverlay({ type: 'messages', position: 'right', size: 'lg' }),
        });
        break;

      case 'scheduling':
        if (intent.extractedEntities.dates.length > 0) {
          actions.push({
            label: `View ${intent.extractedEntities.dates[0]}`,
            action: () => setActiveCanvas('calendar'),
          });
        }
        actions.push({
          label: 'Create Event',
          action: () => openOverlay({ type: 'create-event', position: 'center', size: 'md' }),
        });
        break;

      case 'analysis':
        actions.push({
          label: 'Open Analytics',
          action: () => setActiveCanvas('analytics'),
        });
        break;

      default:
        break;
    }

    return actions;
  }, [openOverlay, setActiveCanvas]);

  return {
    activeIntent,
    processInput,
    suggestActions,
    detectIntent,
  };
}

// ============================================================================
// CANVAS MAPPING
// ============================================================================

export const canvasConfig: Record<CanvasType, {
  title: string;
  icon: string;
  description: string;
  primaryIntent: IntentCategory;
}> = {
  conversation: {
    title: 'Chat',
    icon: 'MessageSquare',
    description: 'Talk to KOSMOS',
    primaryIntent: 'conversation',
  },
  analytics: {
    title: 'Analytics',
    icon: 'BarChart3',
    description: 'Data & Insights',
    primaryIntent: 'analysis',
  },
  calendar: {
    title: 'Calendar',
    icon: 'Calendar',
    description: 'Schedule & Events',
    primaryIntent: 'scheduling',
  },
  editor: {
    title: 'Editor',
    icon: 'Code',
    description: 'Code & Documents',
    primaryIntent: 'development',
  },
  files: {
    title: 'Files',
    icon: 'Folder',
    description: 'Documents & Storage',
    primaryIntent: 'documentation',
  },
  workflows: {
    title: 'Workflows',
    icon: 'GitBranch',
    description: 'Automation',
    primaryIntent: 'operations',
  },
  settings: {
    title: 'Settings',
    icon: 'Settings',
    description: 'Configuration',
    primaryIntent: 'navigation',
  },
};
