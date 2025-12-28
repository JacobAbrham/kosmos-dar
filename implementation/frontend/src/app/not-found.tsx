import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl p-8">
          <div className="text-8xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
            404
          </div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-400 mb-6">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
              Browse Agents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
