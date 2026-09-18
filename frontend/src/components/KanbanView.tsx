import React, { useState } from 'react';
import { Copy, Check, PlusCircle, CreditCard, Edit2, AlertCircle } from 'lucide-react';
import { ClientData } from '../services/api';

interface KanbanViewProps {
  clients: ClientData[];
  onUpdateStatus: (clientId: string, newStatus: string) => void;
  onSelectClient: (client: ClientData) => void;
  onRecordPix: (client: ClientData) => void;
}

const COLUMNS = [
  {
    id: 'Saldo Saudável',
    title: 'Saldo Saudável',
    color: 'var(--status-healthy)',
    dotColor: '#10b981',
  },
  {
    id: 'Alerta / Próximo de Esgotar',
    title: 'Alerta / Próximo de Esgotar',
    color: 'var(--status-alert)',
    dotColor: '#f59e0b',
  },
  {
    id: 'Pix Gerado / Enviado ao Cliente',
    title: 'Pix Gerado / Enviado',
    color: 'var(--status-pix)',
    dotColor: '#8b5cf6',
  },
  {
    id: 'Pago / Aguardando Compensação',
    title: 'Pago / Aguardando Compensação',
    color: 'var(--status-paid)',
    dotColor: '#3b82f6',
  },
  {
    id: 'Saldo Confirmado',
    title: 'Saldo Confirmado',
    color: 'var(--status-confirmed)',
    dotColor: '#06b6d4',
  },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  clients,
  onUpdateStatus,
  onSelectClient,
  onRecordPix,
}) => {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedClientId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('text/plain') || draggedClientId;
    if (clientId) {
      onUpdateStatus(clientId, targetStatus);
    }
    setDraggedClientId(null);
  };

  const handleCopyPix = (e: React.MouseEvent, client: ClientData) => {
    e.stopPropagation();
    if (!client.pixCode) return;
    navigator.clipboard.writeText(client.pixCode);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="kanban-container">
      {COLUMNS.map(col => {
        const colClients = clients.filter(c => c.status === col.id);

        return (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              <div className="column-title-wrapper">
                <span className="column-dot" style={{ backgroundColor: col.dotColor }} />
                <span>{col.title}</span>
              </div>
              <span className="column-count">{colClients.length}</span>
            </div>

            <div className="kanban-cards-list">
              {colClients.map(client => {
                // Cálculo da barra de progresso (dias restantes vs ciclo estimado de 15 dias)
                const percent = Math.min(Math.max((client.remainingDays / 15) * 100, 0), 100);
                const isAlert = client.remainingDays <= 2;
                const isWarning = client.remainingDays <= 4;
                const barColor = isAlert ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

                return (
                  <div
                    key={client.id}
                    className={`client-card ${draggedClientId === client.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, client.id)}
                    onClick={() => onSelectClient(client)}
                  >
                    <div className="card-header">
                      <div>
                        <div className="client-name">{client.name}</div>
                        {client.metaAccountId && (
                          <div className="meta-id-tag">ID: {client.metaAccountId}</div>
                        )}
                      </div>
                      <button
                        className="btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        onClick={e => {
                          e.stopPropagation();
                          onSelectClient(client);
                        }}
                        title="Editar cliente"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>

                    <div className="card-stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Gasto Diário</span>
                        <span className="stat-value">R$ {client.dailySpend.toFixed(2)}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Último Pix</span>
                        <span className="stat-value">R$ {client.lastPixValue.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="remaining-bar-wrapper">
                      <div className="remaining-bar-header">
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isAlert && <AlertCircle size={12} color="#ef4444" />}
                          Autonomia Restante
                        </span>
                        <span style={{ fontWeight: 700, color: barColor }}>
                          {client.remainingDays <= 0 ? 'Zerando hoje' : `${client.remainingDays} dias`}
                        </span>
                      </div>
                      <div className="remaining-progress">
                        <div
                          className="remaining-progress-fill"
                          style={{ width: `${percent}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Previsão zera em:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {client.depletionDate ? client.depletionDate.split('-').reverse().join('/') : 'A calcular'}
                      </strong>
                    </div>

                    <div className="card-footer">
                      {client.pixCode ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={e => handleCopyPix(e, client)}
                          title="Copiar link ou chave Pix"
                        >
                          {copiedId === client.id ? (
                            <>
                              <Check size={12} color="#34d399" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copiar Pix
                            </>
                          )}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sem Pix salvo</span>
                      )}

                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={e => {
                          e.stopPropagation();
                          onRecordPix(client);
                        }}
                        title="Registrar nova injeção de saldo Pix"
                      >
                        <CreditCard size={12} />
                        Registrar Pix
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
