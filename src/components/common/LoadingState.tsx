import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Chargement des données en cours...',
  subMessage = 'Connexion à Cloud Firestore...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-100 shadow-xs min-h-[320px]">
      <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
      <h3 className="text-base font-semibold text-gray-800">{message}</h3>
      <p className="text-sm text-gray-500 mt-1">{subMessage}</p>
    </div>
  );
};
