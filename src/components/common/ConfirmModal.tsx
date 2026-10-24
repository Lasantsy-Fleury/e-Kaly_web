import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  subtitle?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface AlertOptions {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  variant?: 'error' | 'warning' | 'info' | 'success';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface DialogState {
  isOpen: boolean;
  isAlert: boolean;
  title: string;
  subtitle?: string;
  message: React.ReactNode;
  confirmText: string;
  cancelText: string;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'error';
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    isAlert: false,
    title: '',
    message: '',
    confirmText: 'Confirmer',
    cancelText: 'Annuler',
    variant: 'info',
  });

  const resolveRef = useRef<((value: any) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        isOpen: true,
        isAlert: false,
        title: options.title || 'Confirmation requise',
        subtitle: options.subtitle,
        message: options.message,
        confirmText: options.confirmText || 'Confirmer',
        cancelText: options.cancelText || 'Annuler',
        variant: options.variant || 'info',
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      const opts: AlertOptions =
        typeof options === 'string'
          ? { message: options, title: 'Information', variant: 'info' }
          : options;

      setDialog({
        isOpen: true,
        isAlert: true,
        title: opts.title || (opts.variant === 'error' ? 'Erreur' : 'Information'),
        message: opts.message,
        confirmText: opts.confirmText || 'Compris',
        cancelText: '',
        variant: opts.variant || 'info',
      });
    });
  }, []);

  const handleConfirm = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  };

  const handleCancel = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  };

  const getVariantStyles = () => {
    switch (dialog.variant) {
      case 'danger':
      case 'error':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100',
          titleColor: 'text-red-900',
          confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100',
          titleColor: 'text-amber-900',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: 'bg-emerald-100',
          titleColor: 'text-emerald-900',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          titleColor: 'text-gray-900',
          confirmBtn: 'bg-green-700 hover:bg-green-800 text-white shadow-xs',
        };
    }
  };

  const currentStyles = getVariantStyles();

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}

      <AnimatePresence>
        {dialog.isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={dialog.isAlert ? handleConfirm : handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl shrink-0 ${currentStyles.iconBg}`}>
                    {currentStyles.icon}
                  </div>
                  <div>
                    <h3 className={`text-base font-bold ${currentStyles.titleColor}`}>
                      {dialog.title}
                    </h3>
                    {dialog.subtitle && (
                      <p className="text-xs text-gray-500 mt-0.5">{dialog.subtitle}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dialog.isAlert ? handleConfirm : handleCancel}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Content */}
              <div className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-6">
                {typeof dialog.message === 'string' ? (
                  <p className="whitespace-pre-line">{dialog.message}</p>
                ) : (
                  dialog.message
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {!dialog.isAlert && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    {dialog.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-colors ${currentStyles.confirmBtn}`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
