'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Shield, Smartphone } from 'lucide-react';

// QR Code component - using a simple approach
// For production, install: npm install qrcode.react
// import { QRCodeSVG } from 'qrcode.react';

interface MFASetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * MFA Setup Component for TOTP
 * Allows users to set up two-factor authentication using TOTP
 */
export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [secret, setSecret] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize MFA setup
  useEffect(() => {
    const initializeMFA = async () => {
      try {
        // TODO: Replace with actual API call when backend is ready
        // const response = await fetch('/api/v1/auth/mfa/setup', {
        //   method: 'POST',
        //   headers: { 'Authorization': `Bearer ${getAccessToken()}` }
        // });
        // const data = await response.json();
        // setSecret(data.secret);
        // setQrCodeUrl(data.qr_code_url);

        // Mock data for now
        const mockSecret = 'JBSWY3DPEHPK3PXP';
        const mockEmail = 'user@example.com';
        const mockIssuer = 'KOSMOS';
        setSecret(mockSecret);
        setQrCodeUrl(`otpauth://totp/${encodeURIComponent(mockIssuer)}:${encodeURIComponent(mockEmail)}?secret=${mockSecret}&issuer=${encodeURIComponent(mockIssuer)}`);
      } catch (err) {
        setError('Failed to initialize MFA setup');
        console.error(err);
      }
    };

    initializeMFA();
  }, []);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(null);

    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/v1/auth/mfa/verify', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${getAccessToken()}`
      //   },
      //   body: JSON.stringify({ code: verificationCode })
      // });
      // 
      // if (!response.ok) {
      //   throw new Error('Invalid verification code');
      // }

      // Mock verification for now
      if (verificationCode.length === 6) {
        setTimeout(() => {
          setIsVerifying(false);
          onComplete?.();
        }, 1000);
      } else {
        throw new Error('Verification code must be 6 digits');
      }
    } catch (err) {
      setIsVerifying(false);
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  if (step === 'setup') {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-100 mb-2">
            Set Up Two-Factor Authentication
          </h2>
          <p className="text-gray-400 text-sm">
            Scan the QR code with your authenticator app to enable 2FA
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center p-4 bg-white rounded-lg">
            {qrCodeUrl ? (
              // Using an external QR code service for now
              // In production, use qrcode.react: <QRCodeSVG value={qrCodeUrl} size={200} />
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                alt="MFA QR Code"
                className="w-[200px] h-[200px]"
              />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 text-gray-400">
                Loading QR code...
              </div>
            )}
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Or enter this code manually:
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-200 font-mono text-sm">
                {secret}
              </code>
              <button
                onClick={handleCopySecret}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-800/30 rounded-lg p-4 space-y-2 text-sm text-gray-400">
            <p className="font-medium text-gray-300 mb-2">Supported Apps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
              <li>Any TOTP-compatible app</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('verify')}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              I&apos;ve Scanned the Code
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Verification step
  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-100 mb-2">
          Verify Setup
        </h2>
        <p className="text-gray-400 text-sm">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setVerificationCode(value);
              setError(null);
            }}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-200 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="000000"
            autoFocus
            required
            disabled={isVerifying}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={verificationCode.length !== 6 || isVerifying}
            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Enable'}
          </button>
          <button
            type="button"
            onClick={() => setStep('setup')}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            disabled={isVerifying}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
