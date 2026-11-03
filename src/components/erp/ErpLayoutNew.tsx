import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../common/ToastContainer';

export const ErpLayoutNew: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
};
