import React from 'react';
import {
  Utensils,
  LayoutDashboard,
  Compass,
  Users,
  CalendarDays,
  QrCode,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck,
  X,
} from 'lucide-react';
import { UserAccount } from '../../types';

export type NavTab = 'dashboard' | 'sessions' | 'students' | 'distributions' | 'attendance' | 'accounts';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentAccount: UserAccount | null;
  onSignOut: () => void;
  pendingRequestsCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentAccount,
  onSignOut,
  pendingRequestsCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const tabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'Tableau de bord',
      icon: LayoutDashboard,
    },
    {
      id: 'sessions' as NavTab,
      label: 'Sessions de voyage',
      icon: Compass,
    },
    {
      id: 'students' as NavTab,
      label: 'Étudiants',
      icon: Users,
    },
    {
      id: 'distributions' as NavTab,
      label: 'Distributions',
      icon: CalendarDays,
    },
    {
      id: 'attendance' as NavTab,
      label: 'Pointages',
      icon: QrCode,
    },
    ...(currentAccount?.role === 'admin'
      ? [
          {
            id: 'accounts' as NavTab,
            label: 'Comptes & pointeurs',
            icon: ShieldCheck,
            badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          },
        ]
      : []),
  ];

  const handleTabClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'AD';
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-xs ${
          isMobileOpen
            ? 'translate-x-0 w-64'
            : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Top: Branding & Collapse Toggle */}
        <div className="flex flex-col">
          <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Utensils className="w-5 h-5" />
              </div>

              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col min-w-0 transition-opacity duration-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold tracking-tight text-gray-900 truncate">
                      e-Kaly
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 truncate">
                    Voyages d'Études
                  </span>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 md:hidden"
              title="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Retract/Expand Toggle button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:inline-flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? 'Déployer la barre latérale' : 'Rétracter la barre latérale'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const showExpanded = !isCollapsed || isMobileOpen;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  title={!showExpanded ? tab.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative group ${
                    isActive
                      ? 'bg-green-50 text-green-800'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  } ${!showExpanded ? 'justify-center' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />

                  {showExpanded && (
                    <span className="truncate flex-1 text-left text-xs font-semibold">
                      {tab.label}
                    </span>
                  )}

                  {typeof tab.badge === 'number' && (
                    <span
                      className={`${
                        showExpanded
                          ? 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800'
                          : 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500'
                      }`}
                    >
                      {showExpanded ? tab.badge : ''}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-green-600 rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: User Profile & Logout */}
        {currentAccount && (
          <div className="p-3 border-t border-gray-100 bg-gray-50/50">
            {(!isCollapsed || isMobileOpen) ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-green-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {getInitials(currentAccount.displayName, currentAccount.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {currentAccount.displayName || currentAccount.email}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {currentAccount.role === 'admin' ? 'Administrateur' : 'Pointeur'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-lg transition-colors shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-gray-500" />
                  <span>Déconnexion</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full bg-green-600 text-white font-bold text-xs flex items-center justify-center shadow-xs"
                  title={`${currentAccount.displayName || currentAccount.email} (${currentAccount.role === 'admin' ? 'Administrateur' : 'Pointeur'})`}
                >
                  {getInitials(currentAccount.displayName, currentAccount.email)}
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Se déconnecter"
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
