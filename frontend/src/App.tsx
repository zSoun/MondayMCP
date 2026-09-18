import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { KanbanView } from './components/KanbanView';
import { ClientModal } from './components/ClientModal';
import { RecordPixModal } from './components/RecordPixModal';
import { SettingsModal } from './components/SettingsModal';
import {
  ClientData,
  SettingsData,
  fetchClients,
  fetchSettings,
  updateClientStatus,
  updateClient,
  createClient,
  recordPixPayment,
  triggerManualSync,
} from './services/api';
import { AlertTriangle, Key, Layers, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'kanban'>('kanban');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [needsConfig, setNeedsConfig] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modais
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [isRecordPixOpen, setIsRecordPixOpen] = useState<boolean>(false);
  const [recordPixClient, setRecordPixClient] = useState<ClientData | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, clientsRes] = await Promise.all([
        fetchSettings(),
        fetchClients(),
      ]);

      setSettings(settingsRes);
      if (clientsRes.needsConfig) {
        setNeedsConfig(true);
        setClients([]);
      } else {
        setNeedsConfig(false);
        setClients(clientsRes.clients || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.removeItem('mondaymcp_clients');
    loadData();
  }, []);

  const handleUpdateStatus = async (clientId: string, newStatus: string) => {
    // Atualização otimista na UI
    setClients(prev =>
      prev.map(c => (c.id === clientId ? { ...c, status: newStatus as any } : c))
    );

    try {
      await updateClientStatus(clientId, newStatus);
    } catch (err) {
      console.error('Erro ao atualizar status no Monday:', err);
      // Recarrega em caso de falha
      loadData();
    }
  };

  const handleSaveClient = async (data: Partial<ClientData>) => {
    if (editingClient) {
      const res = await updateClient(editingClient.id, data);
      if (!res.success) {
        throw new Error(res.error || 'Falha ao atualizar no Monday.com');
      }
    } else {
      const res = await createClient(data);
      if (!res.success) {
        throw new Error(res.error || 'Falha ao cadastrar no Monday.com');
      }
    }
    await loadData();
  };

  const handleConfirmPix = async (clientId: string, pixValue: number, pixDate: string) => {
    const target = clients.find(c => c.id === clientId);
    await recordPixPayment(clientId, {
      pixValue,
      pixDate,
      monthlyBudget: target?.monthlyBudget,
      dailySpend: target?.dailySpend,
    });
    await loadData();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerManualSync();
      if (res.success && res.result) {
        alert(
          `Sincronização Concluída!\n\n` +
          `• Total de Clientes: ${res.result.totalClients}\n` +
          `• Contas em Alerta: ${res.result.clientsInAlert.length}\n` +
          `• E-mails disparados para a equipe: ${res.result.emailsSent ? 'Sim' : 'Não'}` +
          (res.result.emailError ? `\n(Aviso E-mail: ${res.result.emailError})` : '')
        );
      }
      await loadData();
    } catch (err: any) {
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const clientsInAlert = clients.filter(
    c => c.remainingDays <= (settings?.alertThresholdDays || 2) && c.status !== 'Saldo Confirmado'
  );

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewClient={() => {
          setEditingClient(null);
          setIsClientModalOpen(true);
        }}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      <main className="main-content">
        {/* Banner de Contas em Alerta */}
        {clientsInAlert.length > 0 && (
          <div className="alert-banner">
            <div className="alert-banner-left">
              <AlertTriangle size={20} color="#ef4444" />
              <span>
                <strong>Atenção Equipe:</strong> {clientsInAlert.length}{' '}
                {clientsInAlert.length === 1 ? 'cliente está' : 'clientes estão'} com saldo acabando em{' '}
                {settings?.alertThresholdDays || 2} dias ou menos!
              </span>
            </div>
            <button className="btn btn-secondary" onClick={() => setActiveTab('kanban')}>
              Ver no Kanban
            </button>
          </div>
        )}

        {/* Estado sem configuração do Monday */}
        {needsConfig && (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px',
              textAlign: 'center',
              maxWidth: '680px',
              margin: '40px auto',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Key size={32} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginBottom: '10px' }}>
              Conecte sua conta do Monday.com
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Para começar a gerenciar o saldo e as previsões de recarga dos seus clientes do Meta Ads, insira seu
              <strong> Personal API Token do Monday</strong> e clique em <strong>"Criar Quadro no Monday"</strong> para
              estruturar tudo automaticamente!
            </p>
            <button className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={() => setIsSettingsOpen(true)}>
              <Layers size={18} />
              Configurar Monday.com Agora
            </button>
          </div>
        )}

        {/* Visualizações Principais */}
        {!needsConfig && (
          <>
            {clients.length === 0 && !loading && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px dashed rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>
                    Quadro conectado ao Monday (ID: {settings?.mondayBoardId || '18431725532'})
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    Nenhuma conta cadastrada ainda neste quadro. Clique em "+ Novo Cliente" para adicionar ou insira itens diretamente no Monday.com!
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingClient(null);
                    setIsClientModalOpen(true);
                  }}
                >
                  + Novo Cliente
                </button>
              </div>
            )}

            {activeTab === 'calendar' ? (
              <CalendarView
                clients={clients}
                onSelectClient={c => {
                  setEditingClient(c);
                  setIsClientModalOpen(true);
                }}
                onRecordPix={c => {
                  setRecordPixClient(c);
                  setIsRecordPixOpen(true);
                }}
              />
            ) : (
              <KanbanView
                clients={clients}
                onUpdateStatus={handleUpdateStatus}
                onSelectClient={c => {
                  setEditingClient(c);
                  setIsClientModalOpen(true);
                }}
                onRecordPix={c => {
                  setRecordPixClient(c);
                  setIsRecordPixOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Modais */}
      <ClientModal
        client={editingClient}
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
      />

      <RecordPixModal
        client={recordPixClient}
        isOpen={isRecordPixOpen}
        onClose={() => {
          setIsRecordPixOpen(false);
          setRecordPixClient(null);
        }}
        onConfirm={handleConfirmPix}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onRefreshSettings={loadData}
      />
    </div>
  );
};
