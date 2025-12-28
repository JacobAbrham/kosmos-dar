'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'message';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Global notification store (simple implementation)
let notifications: Notification[] = [];
let listeners: ((notifications: Notification[]) => void)[] = [];

export function pushNotification(notification: Omit<Notification, 'id'>) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const newNotification = { ...notification, id };
  notifications = [...notifications, newNotification];
  listeners.forEach((listener) => listener(notifications));

  // Auto-remove after duration
  if (notification.duration !== 0) {
    setTimeout(() => {
      removeNotification(id);
    }, notification.duration || 5000);
  }

  return id;
}

export function removeNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  listeners.forEach((listener) => listener(notifications));
}

function subscribe(listener: (notifications: Notification[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function AmbientNotifications() {
  const [currentNotifications, setCurrentNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    return subscribe(setCurrentNotifications);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {currentNotifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationToast({ 
  notification, 
  onDismiss 
}: { 
  notification: Notification; 
  onDismiss: () => void;
}) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    message: <MessageCircle className="w-5 h-5 text-indigo-400" />,
  };

  const bgColors = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
    message: 'border-indigo-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "bg-[#1a1a24] border rounded-xl shadow-2xl overflow-hidden",
        bgColors[notification.type]
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {icons[notification.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">{notification.title}</div>
          {notification.message && (
            <div className="text-sm text-gray-400 mt-1">{notification.message}</div>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default AmbientNotifications;
