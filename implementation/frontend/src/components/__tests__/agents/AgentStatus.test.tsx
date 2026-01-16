/**
 * Unit tests for AgentStatus component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatus } from '../agents/AgentStatus';

describe('AgentStatus', () => {
  it('renders agent status', () => {
    const agent = {
      id: 'athena',
      name: 'Athena',
      status: 'active',
      domain: 'Knowledge'
    };

    render(<AgentStatus agent={agent} />);
    expect(screen.getByText('Athena')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });

  it('displays active status correctly', () => {
    const agent = {
      id: 'athena',
      name: 'Athena',
      status: 'active',
      domain: 'Knowledge'
    };

    render(<AgentStatus agent={agent} />);
    const statusBadge = screen.getByText(/active/i);
    expect(statusBadge).toBeInTheDocument();
  });

  it('displays inactive status correctly', () => {
    const agent = {
      id: 'athena',
      name: 'Athena',
      status: 'inactive',
      domain: 'Knowledge'
    };

    render(<AgentStatus agent={agent} />);
    const statusBadge = screen.getByText(/inactive/i);
    expect(statusBadge).toBeInTheDocument();
  });
});
