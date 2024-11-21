import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MobileNav from './MobileNav';

const MobileLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Area with padding for mobile nav */}
      <div className="pt-16 pb-20 lg:pt-0 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
          {children}
        </div>
      </div>

      {/* Desktop Navigation (hidden on mobile) */}
      <nav className="hidden lg:block bg-white shadow-sm sticky top-0 z-50">
        {/* Existing desktop navigation content */}
      </nav>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
};

export default MobileLayout;