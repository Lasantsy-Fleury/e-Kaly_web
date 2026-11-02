import React from 'react';
import { Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import { NavTab } from './Sidebar';
import { UserAccount } from '../../types';

interface TopBarProps {
  activeTab: NavTab;
  onOpenMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentAccount: UserAccount | null;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Supervision globale des distributions, taux de participation et statistiques en temps réel',
  },
  sessions: {
    title: 'Sessions de voyages d’études',
    subtitle: 'Planification, gestion des promotions et affectation des équipes de pointage',
  },
  students: {
    title: 'Répertoire des étudiants',
    subtitle: 'Gestion des inscrits, cartes d’accès QR Code et statut d’éligibilité',
  },
  distributions: {
    title: 'Distributions alimentaires',
    subtitle: 'Programmation des créneaux de repas, menus servis et règles de distribution',
  },
  attendance: {
    title: 'Journal des pointages',
    subtitle: 'Historique des émargements horodatés et synchronisation multi-terminaux',
  },
  accounts: {
    title: 'Comptes et autorisations',
    subtitle: 'Gestion des rôles, affectations de sessions et validation des accès pointeurs',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onOpenMobile,
  isCollapsed,
  onToggleCollapse,
  currentAccount,
}) => {
  const meta = TAB_TITLES[activeTab] || {
    title: 'Administration',
    subtitle: 'Portail e-Kaly',
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile hamburger & Section Title */}
      <div className="flex items-center gap-3">
        {/* Mobile toggle */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg md:hidden"
          title="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop retract/expand button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden md:inline-flex p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          title={isCollapsed ? 'Déployer la barre latérale' : 'Rétracter la barre latérale'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>

        <div className="flex flex-col">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
            {meta.title}
          </h1>
          <span className="text-[11px] text-gray-400 hidden sm:block truncate max-w-md">
            {meta.subtitle}
          </span>
        </div>
      </div>

      {/* Right: User Profile */}
      <div className="flex items-center gap-3">
        {currentAccount && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="hidden sm:inline font-medium text-gray-700">
              {currentAccount.displayName || currentAccount.email}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
