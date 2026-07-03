'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, CheckCheck, Upload, MessageSquare, MessageCircle, Settings } from 'lucide-react';
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead, Notification } from '@/hooks/use-notifications';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  FILE_UPLOADED: <Upload className="h-4 w-4 text-blue-500" />,
  QUESTION_ASKED: <MessageSquare className="h-4 w-4 text-amber-500" />,
  QUESTION_ANSWERED: <MessageCircle className="h-4 w-4 text-green-500" />,
  MEMBER_INVITED: <Check className="h-4 w-4 text-purple-500" />,
  DATA_ROOM_UPDATED: <Settings className="h-4 w-4 text-app-t3" />,
  PERMISSION_CHANGED: <Settings className="h-4 w-4 text-app-t3" />,
};

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  return (
    <button
      onClick={() => !notification.isRead && onRead(notification.id)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-app-s2 ${!notification.isRead ? 'bg-blue-500/10/50' : ''}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {TYPE_ICONS[notification.type] ?? <Bell className="h-4 w-4 text-app-t3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${notification.isRead ? 'text-app-t2' : 'text-app-text'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-app-t3 line-clamp-2">{notification.message}</p>
        <p className="mt-1 text-xs text-app-t3">{timeAgo(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <div className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-blue-500/100" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: count = 0 } = useUnreadCount();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-app-t3 hover:bg-app-s2"
      >
        {count > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/100 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 animate-scale-in rounded-lg border border-app-border bg-app-s1 shadow-dark-popover z-50">
          <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
            <h3 className="text-sm font-semibold text-app-text">Notifications</h3>
            {count > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-app-t3 hover:text-app-t2"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-app-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-app-t3">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={(id) => markRead.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
