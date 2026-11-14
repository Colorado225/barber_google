import React from 'react';

interface ResponsiveShellProps {
  desktopSidebar: React.ReactNode;
  desktopHeader: React.ReactNode;
  mobileHeader: React.ReactNode;
  mobileActionBar?: React.ReactNode;
  mobileBottomNavigation: React.ReactNode;
  mobileMoreMenu: React.ReactNode;
  children: React.ReactNode;
}

/** Shared ERP chrome: desktop sidebar, compact mobile chrome and one natural document scroll surface. */
export const ResponsiveShell: React.FC<ResponsiveShellProps> = ({
  desktopSidebar,
  desktopHeader,
  mobileHeader,
  mobileActionBar,
  mobileBottomNavigation,
  mobileMoreMenu,
  children,
}) => (
  <div className="min-h-screen bg-[#0d0d0e] text-stone-200 md:flex">
    {mobileMoreMenu}
    {desktopSidebar}
    <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
      {mobileHeader}
      {desktopHeader}
      {mobileActionBar}
      {children}
    </div>
    {mobileBottomNavigation}
  </div>
);
