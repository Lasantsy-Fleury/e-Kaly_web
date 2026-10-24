import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Une erreur est survenue',
  message,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-red-50/50 rounded-xl border border-red-200 min-h-[300px]">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-red-900 mb-1">{title}</h3>
      <p className="text-sm text-red-700 max-w-md mb-6 whitespace-pre-wrap">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-red-300 text-red-800 text-sm font-medium rounded-lg shadow-xs transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </button>
      )}
    </div>
  );
};
