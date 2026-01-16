/**
 * KOSMOS DAR Agent Execution Sync Component
 * 
 * Syncs WebSocket updates with Jotai atoms for real-time agent execution state.
 * This component should be included in the app providers to enable real-time updates.
 */

'use client';

import { useAgentExecutionSync } from '@/hooks/useAgentExecution';

/**
 * Component that syncs WebSocket updates with Jotai atoms
 * Include this in your app providers to enable real-time agent execution updates
 */
export function AgentExecutionSync() {
  useAgentExecutionSync();
  return null; // This component doesn't render anything
}
