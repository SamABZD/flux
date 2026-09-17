import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  ArrowUpRight,
  Bell,
  MagnifyingGlass,
  SquaresFour,
  CaretDown,
  GearSix,
} from '@phosphor-icons/react';
import { Brand } from './brand';
import { Avatar } from '@/design-system/avatar';
import { Badge } from '@/design-system/badge';
import { IconButton } from '@/design-system/button';
import { ResponsiveDialog } from '@/design-system/modal';
import { EmptyState } from '@/design-system/feedback';
import { Tooltip, TooltipProvider } from '@/design-system/tooltip';
import { destinations, primaryDestinations, workspaceDestinations } from '@/app/destinations';
import { SearchDialog } from '@/features/navigation/search-dialog';
import { ToastProvider } from '@/design-system/toast';
import { RouteLoading } from './route-loading';
import { ProfileDialog } from '@/features/profile/profile-dialog';

export function AppShell() {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const inWorkspace = workspaceDestinations.some(
    (item) => item.path === pathname || pathname.startsWith(`${item.path}/`),
  );
  useEffect(() => {
    document.title = `${pathname.startsWith('/analytics/') ? 'Spending details' : pathname.startsWith('/subscriptions/') ? 'Subscription details' : pathname.startsWith('/cards/payments/') ? 'Card payment details' : pathname.startsWith('/cards/') ? 'Card details' : pathname === '/demo/card-payments' ? 'Card payment simulator' : pathname.startsWith('/payments/') ? 'Payments' : pathname.startsWith('/transactions/') ? 'Transaction details' : pathname.startsWith('/accounts/') ? 'Account details' : (destinations.find((item) => item.path === pathname)?.label ?? 'Page not found')} · Flux`;
    if (previousPath.current !== pathname) {
      mainRef.current?.focus();
      window.scrollTo({ top: 0 });
      previousPath.current = pathname;
    }
  }, [pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <div className="app-shell">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <header className="app-header">
            <div className="app-header-inner">
              <div className="header-brand">
                <Brand />
                <Badge>Demo</Badge>
              </div>
              <nav className="primary-nav" aria-label="Primary navigation">
                {primaryDestinations.map(({ path, label, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      isActive || (path === '/home' && inWorkspace)
                        ? 'primary-link is-active'
                        : 'primary-link'
                    }
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="header-actions">
                <Tooltip content="Search Flux · Ctrl / ⌘ K">
                  <IconButton label="Search Flux" onClick={() => setSearchOpen(true)}>
                    <MagnifyingGlass size={21} />
                  </IconButton>
                </Tooltip>
                <Tooltip content="Notifications">
                  <IconButton label="Notifications" onClick={() => setNotificationsOpen(true)}>
                    <Bell size={21} />
                  </IconButton>
                </Tooltip>
                <span className="header-action-divider" />
                <button
                  className="profile-trigger"
                  aria-label="Open profile"
                  onClick={() => setProfileOpen(true)}
                >
                  <Avatar name="Alex Morgan" size="small" />
                  <CaretDown size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="workspace-bar">
              <div className="workspace-bar-inner">
                {inWorkspace ? (
                  <nav aria-label="Workspace sections" className="workspace-nav">
                    {workspaceDestinations.map(({ path, label }) => (
                      <NavLink key={path} to={path}>
                        {path === '/home' ? 'Overview' : label}
                      </NavLink>
                    ))}
                  </nav>
                ) : (
                  <span className="workspace-label">
                    Your workspace <span>/</span>{' '}
                    {destinations.find(
                      (item) => item.path === pathname || pathname.startsWith(`${item.path}/`),
                    )?.label ?? 'Explore'}
                  </span>
                )}
                <Link to="/settings" className="workspace-settings">
                  <GearSix size={17} aria-hidden="true" />
                  Settings
                </Link>
              </div>
            </div>
          </header>
          <main className="app-main" id="main-content" tabIndex={-1} ref={mainRef}>
            <Suspense fallback={<RouteLoading />}>
              <Outlet />
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>
              <span className="status-dot" />
              Demo workspace <span className="footer-divider">/</span> No real accounts or money.
            </span>
            <Link to="/design-system">
              Built with care <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </footer>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {primaryDestinations.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  isActive || (path === '/home' && inWorkspace)
                    ? 'mobile-link is-active'
                    : 'mobile-link'
                }
              >
                <Icon size={23} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <button
              className={`mobile-link ${!primaryDestinations.some((item) => item.path === pathname || pathname.startsWith(`${item.path}/`)) && !inWorkspace ? 'is-active' : ''}`}
              onClick={() => setMoreOpen(true)}
              aria-label="More navigation"
            >
              <SquaresFour size={23} aria-hidden="true" />
              <span>More</span>
            </button>
          </nav>
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
          <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
          <ResponsiveDialog
            open={notificationsOpen}
            onOpenChange={setNotificationsOpen}
            title="Notifications"
            description="A place for the updates that matter."
          >
            <EmptyState
              icon={<Bell size={32} />}
              title="Nothing to catch up on"
              description="Account updates and helpful reminders will appear here when notifications are available."
            />
          </ResponsiveDialog>
          <ResponsiveDialog
            open={moreOpen}
            onOpenChange={setMoreOpen}
            title="More from Flux"
            description="Everything else, close at hand."
          >
            <nav className="more-nav" aria-label="More destinations">
              {destinations.slice(4).map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path} onClick={() => setMoreOpen(false)}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </ResponsiveDialog>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
