import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  Student,
  Distribution,
  Attendance,
  UserAccount,
  AuditLog,
  Session,
} from './types';
import {
  subscribeToAuthAndProfile,
  signOutUser,
} from './services/authService';
import { subscribeToSessions } from './services/sessionService';
import { subscribeToStudents } from './services/studentService';
import {
  subscribeToDistributions,
  autoSynchronizeDistributionStatuses,
} from './services/distributionService';
import { subscribeToAttendance } from './services/attendanceService';
import {
  subscribeToUserAccounts,
  subscribeToAuditLogs,
} from './services/accountService';

import { Sidebar, NavTab } from './components/common/Sidebar';
import { TopBar } from './components/common/TopBar';
import { LoadingState } from './components/common/LoadingState';
import { ErrorState } from './components/common/ErrorState';
import { AuthScreen } from './components/auth/AuthScreen';
import { DashboardView } from './components/dashboard/DashboardView';
import { StudentsView } from './components/students/StudentsView';
import { DistributionsView } from './components/distributions/DistributionsView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { AccountsView } from './components/accounts/AccountsView';
import { SessionsView } from './components/sessions/SessionsView';
import { SessionModal } from './components/sessions/SessionModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Retractable Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ekaly_sidebar_collapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sessions state (Voyages d'études M1 ENI)
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Real-time Data
  const [students, setStudents] = useState<Student[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Loading states
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const initialDataLoadedRef = useRef(false);
  const sessionInitializedRef = useRef(false);
  const distributionsRef = useRef<Distribution[]>(distributions);
  distributionsRef.current = distributions;

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ekaly_sidebar_collapsed', String(next));
      return next;
    });
  };

  // 1. Subscribe to Auth and Current Profile
  useEffect(() => {
    const unsub = subscribeToAuthAndProfile(
      (fbUser, account) => {
        setCurrentUser(fbUser);
        setCurrentAccount(account);
        setAuthLoading(false);
      },
      (err) => {
        console.error('Auth subscription error:', err);
        setAuthError(err instanceof Error ? err.message : 'Erreur d’authentification');
        setAuthLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const authUserId = currentUser?.uid;
  const userRole = currentAccount?.role;
  const userStatus = currentAccount?.status;

  // 2. Subscribe to Collections when authenticated & approved as admin
  useEffect(() => {
    if (!authUserId || !currentAccount || userStatus !== 'approved' || userRole !== 'admin') {
      setSessions([]);
      setStudents([]);
      setDistributions([]);
      setAttendances([]);
      setAccounts([]);
      setAuditLogs([]);
      initialDataLoadedRef.current = false;
      sessionInitializedRef.current = false;
      return;
    }

    if (!initialDataLoadedRef.current) {
      setDataLoading(true);
    }
    setDataError(null);

    const unsubs: (() => void)[] = [];

    // Sessions
    unsubs.push(
      subscribeToSessions(
        (data) => {
          setSessions(data);
          if (!sessionInitializedRef.current && data.length > 0) {
            sessionInitializedRef.current = true;
            const ongoing = data.find((s) => s.statut === 'ongoing') || data[0];
            if (ongoing) setSelectedSessionId(ongoing.id);
          }
        },
        (err) => console.error('Sessions error:', err)
      )
    );

    // Students
    unsubs.push(
      subscribeToStudents(
        (data) => {
          setStudents(data);
          initialDataLoadedRef.current = true;
          setDataLoading(false);
        },
        (err) => {
          console.error('Students error:', err);
          setDataError('Erreur de communication avec la base de données PostgreSQL.');
          setDataLoading(false);
        }
      )
    );

    // Distributions
    unsubs.push(
      subscribeToDistributions(
        (data) => {
          setDistributions(data);
        },
        (err) => console.error('Distributions error:', err)
      )
    );

    // Attendance
    unsubs.push(
      subscribeToAttendance(
        (data) => setAttendances(data),
        (err) => console.error('Attendance error:', err)
      )
    );

    // Accounts & Audit (Admins)
    if (userRole === 'admin') {
      unsubs.push(
        subscribeToUserAccounts(
          (data) => setAccounts(data),
          (err) => console.error('Accounts error:', err)
        )
      );

      unsubs.push(
        subscribeToAuditLogs(
          (data) => setAuditLogs(data),
          (err) => console.error('Audit logs error:', err)
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authUserId, userRole, userStatus]);

  // 3. Auto-open and auto-close distributions according to scheduled time slots.
  //    Active admin Web sessions perform convergence periodically in background.
  useEffect(() => {
    if (!authUserId || !currentAccount || userStatus !== 'approved' || userRole !== 'admin') return;

    const tick = () => {
      if (distributionsRef.current.length > 0) {
        autoSynchronizeDistributionStatuses(distributionsRef.current).catch((error) =>
          console.error('Auto-sync distributions error:', error)
        );
      }
    };

    const intervalId = window.setInterval(tick, 15000);
    return () => window.clearInterval(intervalId);
  }, [authUserId, userRole, userStatus]);

  const isPointerUser = currentAccount?.role === 'pointer';
  const pointerSessionId = isPointerUser ? currentAccount?.assignedSessionId : null;

  // Pointers only see distributions of their assigned session
  const visibleDistributions = useMemo(() => {
    if (isPointerUser) {
      if (!pointerSessionId) return [];
      return distributions.filter((d) => d.sessionId === pointerSessionId);
    }
    return distributions;
  }, [distributions, isPointerUser, pointerSessionId]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <LoadingState
          message="Chargement de l'espace e-Kaly..."
          subMessage="Vérification de l'authentification et des autorisations M1 ENI..."
        />
      </div>
    );
  }

  // Not authenticated, pending/suspended, or non-admin
  if (!currentUser || !currentAccount || currentAccount.status !== 'approved' || currentAccount.role !== 'admin') {
    return (
      <AuthScreen
        currentAccount={currentAccount}
        onLoginSuccess={(acc) => setCurrentAccount(acc)}
      />
    );
  }

  const pendingRequestsCount = accounts.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Retractable Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        currentAccount={currentAccount}
        onSignOut={() => signOutUser()}
        pendingRequestsCount={pendingRequestsCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {/* Sticky TopBar */}
        <TopBar
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileMenuOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          currentAccount={currentAccount}
        />

        {/* Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {dataError ? (
            <ErrorState
              message={dataError}
              onRetry={() => window.location.reload()}
            />
          ) : dataLoading ? (
            <LoadingState
              message="Chargement des données du voyage d'études..."
              subMessage="Synchronisation des étudiants M1 ENI et distributions..."
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {activeTab === 'dashboard' && (
                  <DashboardView
                    students={students}
                    distributions={visibleDistributions}
                    attendances={attendances}
                    sessions={sessions}
                    selectedSessionId={
                      isPointerUser && pointerSessionId ? pointerSessionId : selectedSessionId
                    }
                    onSelectSessionId={(id) => setSelectedSessionId(id)}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onOpenSessionModal={() => {
                      setEditingSession(null);
                      setShowSessionModal(true);
                    }}
                    accounts={accounts}
                    currentAccount={currentAccount}
                  />
                )}

                {activeTab === 'sessions' && (
                  <SessionsView
                    sessions={sessions}
                    students={students}
                    distributions={visibleDistributions}
                    attendances={attendances}
                    selectedSessionId={
                      isPointerUser && pointerSessionId ? pointerSessionId : selectedSessionId
                    }
                    onSelectSessionId={(id) => setSelectedSessionId(id)}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onOpenSessionModal={() => {
                      setEditingSession(null);
                      setShowSessionModal(true);
                    }}
                    onEditSession={(session) => {
                      setEditingSession(session);
                      setShowSessionModal(true);
                    }}
                  />
                )}

                {activeTab === 'students' && (
                  <StudentsView
                    students={students}
                    sessions={sessions}
                    selectedSessionId={
                      isPointerUser && pointerSessionId ? pointerSessionId : selectedSessionId
                    }
                    onSelectSessionId={(id) => setSelectedSessionId(id)}
                    onOpenSessionModal={() => {
                      setEditingSession(null);
                      setShowSessionModal(true);
                    }}
                  />
                )}

                {activeTab === 'distributions' && (
                  <DistributionsView
                    distributions={visibleDistributions}
                    students={students}
                    attendances={attendances}
                    sessions={sessions}
                    selectedSessionId={
                      isPointerUser && pointerSessionId ? pointerSessionId : selectedSessionId
                    }
                    onSelectSessionId={(id) => setSelectedSessionId(id)}
                    onOpenSessionModal={() => {
                      setEditingSession(null);
                      setShowSessionModal(true);
                    }}
                  />
                )}

                {activeTab === 'attendance' && (
                  <AttendanceView
                    attendances={attendances}
                    distributions={visibleDistributions}
                    students={students}
                    currentAccount={currentAccount}
                  />
                )}

                {activeTab === 'accounts' && (
                  <AccountsView
                    accounts={accounts}
                    auditLogs={auditLogs}
                    currentAccount={currentAccount}
                    sessions={sessions}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Footer épuré */}
        <footer className="border-t border-gray-200 bg-white py-4 px-6 text-xs text-gray-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <span>e-Kaly • Restauration des Étudiants en Voyage d'Études</span>
            <span className="text-gray-400">École Nationale d'Informatique (ENI) • Fianarantsoa</span>
          </div>
        </footer>
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <SessionModal
          initialSession={editingSession}
          onClose={() => {
            setShowSessionModal(false);
            setEditingSession(null);
          }}
          onSaved={(newSessionId) => {
            setShowSessionModal(false);
            setEditingSession(null);
            if (newSessionId) setSelectedSessionId(newSessionId);
          }}
        />
      )}
    </div>
  );
}
