import React, { useEffect, useState } from 'react';
import { X, Download, Printer, Loader2, QrCode } from 'lucide-react';
import { Student } from '../../types';
import {
  generateStudentBadgeCanvas,
  downloadStudentBadge,
} from '../../services/studentService';

interface BadgeModalProps {
  student: Student | null;
  onClose: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({ student, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student) return;
    let isMounted = true;
    setLoading(true);

    generateStudentBadgeCanvas(student)
      .then((canvas) => {
        if (isMounted) {
          setDataUrl(canvas.toDataURL('image/png'));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate badge:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [student]);

  if (!student) return null;

  const handlePrint = () => {
    if (!dataUrl) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>Badge - ${student.matricule}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
            img { max-width: 90mm; height: auto; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-green-700" />
            <h3 className="text-base font-bold text-gray-900">
              Badge e-Kaly — {student.matricule}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-3" />
              <p className="text-xs text-gray-500 font-medium">Chargement du QR Code et rendu du badge...</p>
            </div>
          ) : dataUrl ? (
            <div className="rounded-xl overflow-hidden shadow-md border border-gray-200 bg-white p-2">
              <img
                src={dataUrl}
                alt={`Badge ${student.matricule}`}
                className="w-full max-w-[280px] h-auto object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="text-xs text-red-600 py-8">Impossible de générer le badge.</div>
          )}

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-700 font-bold">
              {student.nom.toUpperCase()} {student.prenoms}
            </p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                Matricule : <span className="font-mono font-medium text-gray-800">{student.matricule}</span>
              </span>
              {student.hasCustomQrCode || student.qrCodeUrl ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  QR code
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  QR code
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !dataUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            Imprimer
          </button>

          <button
            type="button"
            onClick={() => downloadStudentBadge(student)}
            disabled={loading || !dataUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Télécharger PNG ({student.matricule}.png)
          </button>
        </div>
      </div>
    </div>
  );
};
