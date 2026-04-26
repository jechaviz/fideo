import React, { useEffect } from 'react';
import { useBusinessData } from './hooks/useBusinessData';
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';
import { UserRole } from './types';

const App: React.FC = () => {
  const businessData = useBusinessData();
  const { theme, currentRole } = businessData;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const isInternalRole = (role: UserRole): boolean => {
    return ['Admin', 'Empacador', 'Repartidor', 'Cajero'].includes(role);
  };

  if (isInternalRole(currentRole)) {
    return <AdminLayout data={businessData} />;
  } else {
    return <PortalLayout data={businessData} />;
  }
};

export default App;
