import React, { useState } from 'react';
import { X, CreditCard, CheckCircle2 } from 'lucide-react';
import { ClientData } from '../services/api';

interface RecordPixModalProps {
  client: ClientData | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (clientId: string, pixValue: number, pixDate: string) => Promise<void>;
}

export const RecordPixModal: React.FC<RecordPixModalProps> = ({
  client,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !client) return null;

  const [pixValue, setPixValue] = useState<number>(client.lastPixValue || 500);
  const [pixDate, setPixDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(false);

  const dailySpend = client.dailySpend > 0 ? client.dailySpend : 50;
  const newAutonomyDays = pixValue > 0 ? Math.floor(pixValue / dailySpend) : 0;

  const baseDate = new Date(`${pixDate}T12:00:00Z`);
  const newDepletionDateObj = new Date(baseDate.getTime() + newAutonomyDays * 24 * 60 * 60 * 1000);
  const newDepletionFormatted = newDepletionDateObj.toLocaleDateString('pt-BR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(client.id, pixValue, pixDate);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Registrar Recarga Pix</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cliente Selecionado</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>{client.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ritmo atual: R$ {dailySpend.toFixed(2)}/dia
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Valor do Pix Pago / Injetado (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-input"
                style={{ fontSize: '1.2rem', fontWeight: 700 }}
                value={pixValue || ''}
                onChange={e => setPixValue(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data da Recarga / Pagamento *</label>
              <input
                type="date"
                required
                className="form-input"
                value={pixDate}
                onChange={e => setPixDate(e.target.value)}
              />
            </div>

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '14px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600, textTransform: 'uppercase' }}>
                Previsão Calculada
              </div>
              <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>
                +<strong>{newAutonomyDays} dias</strong> de autonomia gerada
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nova data estimada de término: <strong>{newDepletionFormatted}</strong>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <CheckCircle2 size={16} />
              {loading ? 'Confirmando no Monday...' : 'Confirmar Recarga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
