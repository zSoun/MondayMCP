import React from 'react';
import { Calendar, Kanban, RefreshCw, Plus, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { SettingsData } from '../services/api';

interface HeaderProps {
  activeTab: 'calendar' | 'kanban';
  setActiveTab: (tab: 'calendar' | 'kanban') => void;
  settings: SettingsData | null;
  onOpenSettings: () => void;
  onOpenNewClient: () => void;
  onSync: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenSettings,
  onOpenNewClient,
  onSync,
  isSyncing,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <Calendar size={22} />
        </div>
        <div>
          <div className="brand-title">MondayMCP • Meta Ads</div>
          <div className="brand-subtitle">
            Gestão de Saldo & Recargas Pix
            {settings?.mondayConnected ? (
              <span className="monday-badge connected">
                <CheckCircle2 size={12} /> Monday Conectado {settings.mondayUser?.name ? `(${settings.mondayUser.name})` : ''}
              </span>
            ) : (
              <span className="monday-badge disconnected">
                <AlertCircle size={12} /> Monday Desconectado
              </span>
            )}
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          title="Visualização em Calendário"
        >
          <Calendar size={16} />
          Calendário
        </button>
        <button
          className={`nav-tab ${activeTab === 'kanban' ? 'active' : ''}`}
          onClick={() => setActiveTab('kanban')}
          title="Visualização em Quadro Kanban"
        >
          <Kanban size={16} />
          Kanban Monday
        </button>
      </nav>

      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onSync}
          disabled={isSyncing}
          title="Verificar saldos e notificar equipe agora"
        >
          <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
          {isSyncing ? 'Sincronizando...' : 'Verificar & Notificar'}
        </button>

        <button className="btn btn-primary" onClick={onOpenNewClient}>
          <Plus size={16} />
          Novo Cliente
        </button>

        <button className="btn-icon" onClick={onOpenSettings} title="Configurações e Integrações">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
