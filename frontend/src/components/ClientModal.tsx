import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { ClientData } from '../services/api';

interface ClientModalProps {
  client: ClientData | null; // se null, é criação
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ClientData>) => Promise<void>;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  client,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<ClientData>>({
    name: '',
    metaAccountId: '',
    monthlyBudget: 3000,
    dailySpend: 100,
    lastPixDate: new Date().toISOString().split('T')[0],
    lastPixValue: 500,
    status: 'Saldo Saudável',
    pixCode: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        metaAccountId: client.metaAccountId || '',
        monthlyBudget: client.monthlyBudget || 0,
        dailySpend: client.dailySpend || 0,
        lastPixDate: client.lastPixDate || '',
        lastPixValue: client.lastPixValue || 0,
        status: client.status || 'Saldo Saudável',
        pixCode: client.pixCode || '',
        notes: client.notes || '',
      });
    } else {
      setFormData({
        name: '',
        metaAccountId: '',
        monthlyBudget: 3000,
        dailySpend: 100,
        lastPixDate: new Date().toISOString().split('T')[0],
        lastPixValue: 500,
        status: 'Saldo Saudável',
        pixCode: '',
        notes: '',
      });
    }
  }, [client, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Por favor, informe o Nome da Empresa / Cliente.');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      alert(`Erro ao salvar no Monday.com: ${err.message || 'Verifique a conexão'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {client ? `Editar: ${client.name}` : 'Cadastrar Novo Cliente no Monday'}
          </h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nome da Empresa / Cliente *</label>
              <input
                className="form-input"
                required
                placeholder="Ex: Art Móveis"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status da Recarga</label>
                <select
                  className="form-select"
                  value={formData.status || 'Saldo Saudável'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Saldo Saudável">Saldo Saudável</option>
                  <option value="Alerta / Próximo de Esgotar">Alerta / Próximo de Esgotar</option>
                  <option value="Pix Gerado / Enviado ao Cliente">Pix Gerado / Enviado ao Cliente</option>
                  <option value="Pago / Aguardando Compensação">Pago / Aguardando Compensação</option>
                  <option value="Saldo Confirmado">Saldo Confirmado</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pessoa Responsável (Monday)</label>
                <input
                  className="form-input"
                  disabled
                  placeholder="Atribuído no Monday"
                  value={formData.person || 'Não atribuído no Monday'}
                  style={{ opacity: 0.8, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Orçamento Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="Ex: 3000"
                  value={formData.monthlyBudget !== undefined && formData.monthlyBudget !== null ? formData.monthlyBudget : ''}
                  onChange={e => {
                    const val = e.target.value;
                    const budget = val === '' ? 0 : parseFloat(val) || 0;
                    setFormData({
                      ...formData,
                      monthlyBudget: budget,
                      dailySpend: formData.dailySpend ? formData.dailySpend : Math.round(budget / 30),
                    });
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gasto Diário Médio (R$/dia)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="Se vazio, calcula Orçamento / 30"
                  value={formData.dailySpend !== undefined && formData.dailySpend !== null ? formData.dailySpend : ''}
                  onChange={e => setFormData({ ...formData, dailySpend: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data do Último Pix</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.lastPixDate || ''}
                  onChange={e => setFormData({ ...formData, lastPixDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor do Último Pix (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="Ex: 500"
                  value={formData.lastPixValue !== undefined && formData.lastPixValue !== null ? formData.lastPixValue : ''}
                  onChange={e => setFormData({ ...formData, lastPixValue: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando no Monday...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
