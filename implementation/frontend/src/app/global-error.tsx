'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ 
        margin: 0, 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#030712',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ 
          maxWidth: '400px', 
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          border: '1px solid rgba(55, 65, 81, 0.5)',
          borderRadius: '0.75rem',
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            margin: '0 auto 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#f87171" 
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 style={{ 
            color: '#f3f4f6', 
            fontSize: '1.25rem', 
            marginBottom: '0.5rem' 
          }}>
            Application Error
          </h2>
          <p style={{ 
            color: '#9ca3af', 
            marginBottom: '1.5rem' 
          }}>
            {error.message || 'A critical error occurred'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
