import { useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', description: 'PANEL EJECUTIVO', section: 'GESTION PRINCIPAL' },
  { id: 'clients', label: 'Clientes', description: 'CRM Y GESTION DE CLIENTES', section: 'GESTION PRINCIPAL' },
  { id: 'appointments', label: 'Citas', description: 'AGENDA Y PROGRAMACION', section: 'GESTION PRINCIPAL' },
  { id: 'team', label: 'Equipo', description: 'RENDIMIENTO Y FEEDBACK', section: 'GESTION PRINCIPAL' },
  { id: 'messaging', label: 'Mensajeria', description: 'WHATSAPP Y META', section: 'COMUNICACION' },
  { id: 'chat-ai', label: 'Chat IA', description: 'ASISTENTE INTELIGENTE', section: 'COMUNICACION' },
  { id: 'reports', label: 'Reportes', description: 'ANALITICAS Y METRICAS', section: 'PROXIMAMENTE', disabled: true },
  { id: 'inventory', label: 'Inventario', description: 'STOCK Y PRODUCTOS', section: 'PROXIMAMENTE', disabled: true },
  { id: 'billing', label: 'Facturacion', description: 'POS Y CAJA', section: 'PROXIMAMENTE', disabled: true },
];

const MainLayout = ({ children, user, activeSection, onNavigate, onLogout }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'main-layout--collapsed' : ''}`}>
      <Sidebar
        menuItems={MENU_ITEMS}
        activeItem={activeSection}
        onItemClick={onNavigate}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={onLogout}
      />
      <div className="main-layout__content">
        <Header
          user={user}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
        <main className="main-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
