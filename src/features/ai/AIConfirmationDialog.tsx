import React from 'react';
import { AlertTriangle, ShieldCheck, X, Cast, FolderUp, Power } from 'lucide-react';
import { PendingConfirmation } from '../../ai/AIConfirmationManager';

interface AIConfirmationDialogProps {
  pending: PendingConfirmation | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AIConfirmationDialog: React.FC<AIConfirmationDialogProps> = ({
  pending,
  onConfirm,
  onCancel,
}) => {
  if (!pending) return null;

  const renderIcon = () => {
    switch (pending.intent.intent) {
      case 'start_projection':
        return <Cast className="w-6 h-6 text-indigo-400 animate-pulse" />;
      case 'send_file':
        return <FolderUp className="w-6 h-6 text-blue-400" />;
      case 'close_application':
        return <Power className="w-6 h-6 text-rose-400" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
            {renderIcon()}
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Safety Confirmation Required
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">{pending.title}</h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{pending.description}</p>
        </div>

        <div className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Target: <strong className="text-white">{pending.targetDeviceName}</strong>. Safe execution protocol enforced.
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs transition-colors"
          >
            {pending.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
          >
            <span>{pending.confirmLabel || 'Confirm'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
