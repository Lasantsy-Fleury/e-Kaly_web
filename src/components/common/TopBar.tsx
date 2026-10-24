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
    subtitle: 'Vue d’ensemble des distributions, éligibilité et participation étudiante',
  },
  sessions: {
    title: 'Sessions de Voyages d’Études',
    subtitle: 'Organisation, programmation multi-jours et suivi des voyages d’études des M1 ENI',
  },
  students: {
    title: 'Répertoire des Étudiants',
    subtitle: 'Gestion des inscrits, importations Excel et génération des badges QR Code',
  },
  distributions: {
    title: 'Planification des Distributions',
    subtitle: 'Programmation des sessions alimentaires, repas servis et critères d’accès',
  },
  attendance: {
    title: 'Journal des Pointages',
    subtitle: 'Pointages en direct synchronisés depuis les appareils mobiles et contrôles',
  },
  accounts: {
    title: 'Comptes & Autorisations',
    subtitle: 'Approbation des comptes pointeurs, gestion des accès et journal d’audit',
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
