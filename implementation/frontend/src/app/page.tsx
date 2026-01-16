'use client';

import { WorkspaceShell } from '@/components/workspace';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function Home() {
  return (
    <ProtectedRoute>
      <WorkspaceShell />
    </ProtectedRoute>
  );
}
