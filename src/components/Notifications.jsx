import React from 'react';
import useStore from '../store/useStore';

const TYPE_STYLES = {
  info:    'bg-blue-700 border-blue-500 text-blue-50',
  success: 'bg-green-700 border-green-500 text-green-50',
  warning: 'bg-yellow-700 border-yellow-500 text-yellow-50',
  error:   'bg-red-700 border-red-500 text-red-50',
};

const TYPE_ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export default function Notifications() {
  const { notifications } = useStore();

  if (!notifications.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: '320px' }}
    >
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`
            flex items-start gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm
            ${TYPE_STYLES[n.type] || TYPE_STYLES.info}
            animate-[fadeInUp_0.25s_ease-out]
          `}
          style={{
            animation: 'fadeInUp 0.25s ease-out',
          }}
        >
          <span className="flex-shrink-0">{TYPE_ICONS[n.type] || '•'}</span>
          <span>{n.msg}</span>
        </div>
      ))}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
