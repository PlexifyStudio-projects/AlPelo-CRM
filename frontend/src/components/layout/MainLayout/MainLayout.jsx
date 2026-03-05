import { useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', description: 'PANEL EJECUTIVO', section: 'GESTION PRINCIPAL' },
  { id: 'clients', label: 'Clientes', description: 'CRM Y GESTION DE CLIENTES', section: 'GESTION PRINCIPAL' },
  { id: 'team', label: 'Equipo', description: 'RENDIMIENTO Y FEEDBACK', section: 'GESTION PRINCIPAL' },
  { id: 'inbox', label: 'Inbox', description: 'CONVERSACIONES WHATSAPP', section: 'WHATSAPP' },
  { id: 'messaging', label: 'Plantillas', description: 'MENSAJES MASIVOS', section: 'WHATSAPP' },
  { id: 'chat-ai', label: 'Jarvis IA', description: 'ASISTENTE INTELIGENTE', section: 'WHATSAPP' },
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
