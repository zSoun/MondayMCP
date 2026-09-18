import React, { useState, useEffect } from 'react';
import { X, Check, Save, Layers, Mail, Calendar, Key, AlertCircle, Copy, Sliders } from 'lucide-react';
import { SettingsData, saveSettings, testMondayApiKey, provisionMondayBoard, configureExistingMondayBoard } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsData | null;
  onRefreshSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onRefreshSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'monday' | 'alerts' | 'email' | 'calendar'>('monday');
  
  const [apiKey, setApiKey] = useState('');
  const [boardId, setBoardId] = useState('');
  const [thresholdDays, setThresholdDays] = useState(2);
  const [teamEmails, setTeamEmails] = useState('');

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const [testingMonday, setTestingMonday] = useState(false);
  const [mondayTestResult, setMondayTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<string | null>(null);

  const [configuringBoard, setConfiguringBoard] = useState(false);
  const [configBoardResult, setConfigBoardResult] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);

  useEffect(() => {
    if (settings) {
      setBoardId(settings.mondayBoardId || '');
      setThresholdDays(settings.alertThresholdDays || 2);
      setTeamEmails((settings.teamEmails || []).join(', '));

      setSmtpHost(settings.smtp?.host || 'smtp.gmail.com');
      setSmtpPort(settings.smtp?.port || 587);
      setSmtpUser(settings.smtp?.user || '');
      setSmtpFrom(settings.smtp?.from || '');
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleTestMonday = async () => {
    setTestingMonday(true);
    setMondayTestResult(null);
    try {
      const res = await testMondayApiKey(apiKey || undefined);
      if (res.valid) {
        setMondayTestResult({
          valid: true,
          message: `Conexão válida! Usuário: ${res.user?.name || res.user?.email || 'Autenticado'}`,
        });
      } else {
        setMondayTestResult({
          valid: false,
          message: res.error || 'Chave inválida ou erro de conexão com Monday.com.',
        });
      }
    } finally {
      setTestingMonday(false);
    }
  };

  const handleProvisionBoard = async () => {
    setProvisioning(true);
    setProvisionResult(null);
    try {
      const res = await provisionMondayBoard({
        apiKey: apiKey || undefined,
        boardName: 'Controle de Saldo Meta Ads',
      });
      if (res.success && res.boardId) {
        setBoardId(res.boardId);
        setProvisionResult(`Quadro criado com sucesso no Monday! (ID: ${res.boardId})`);
        onRefreshSettings();
      }
    } catch (err: any) {
      setProvisionResult(`Erro ao criar quadro: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handleConfigureExistingBoard = async () => {
    if (!boardId.trim()) {
      alert('Por favor, informe o ID do Quadro primeiro.');
      return;
    }
    setConfiguringBoard(true);
    setConfigBoardResult(null);
    try {
      const res = await configureExistingMondayBoard({
        apiKey: apiKey || undefined,
        boardId: boardId.trim(),
      });
      if (res.success) {
        setConfigBoardResult(res.message || 'Colunas criadas com sucesso no quadro do Monday!');
        onRefreshSettings();
      } else {
        setConfigBoardResult(`Erro: ${res.error}`);
      }
    } catch (err: any) {
      setConfigBoardResult(`Erro ao configurar colunas: ${err.message}`);
    } finally {
      setConfiguringBoard(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        mondayBoardId: boardId,
        alertThresholdDays: thresholdDays,
        teamEmails: teamEmails.split(',').map(e => e.trim()).filter(Boolean),
        smtp: {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          from: smtpFrom,
        },
      };

      if (apiKey) payload.mondayApiKey = apiKey;
      if (smtpPass) payload.smtp.pass = smtpPass;

      await saveSettings(payload);
      setSaveSuccess(true);
      onRefreshSettings();
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const copyFeedLink = () => {
    const url = settings?.icalFeedUrl || `${window.location.origin}/api/calendar/feed.ics`;
    navigator.clipboard.writeText(url);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Configurações & Conexões</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
          <button
            className={`nav-tab ${activeTab === 'monday' ? 'active' : ''}`}
            onClick={() => setActiveTab('monday')}
            style={{ borderRadius: 0 }}
          >
            <Key size={15} /> Monday.com
          </button>
          <button
            className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
            style={{ borderRadius: 0 }}
          >
            <AlertCircle size={15} /> Alertas de Saldo
          </button>
          <button
            className={`nav-tab ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
            style={{ borderRadius: 0 }}
          >
            <Mail size={15} /> E-mail (Equipe)
          </button>
          <button
            className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            style={{ borderRadius: 0 }}
          >
            <Calendar size={15} /> Google Calendar
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            {activeTab === 'monday' && (
              <>
                <div className="form-group">
                  <label className="form-label">API Key do Monday.com (Personal Token)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Cole seu token de API do Monday"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Gere seu token no Monday em: Perfil &gt; Desenvolvedores &gt; API Tokens.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTestMonday}
                    disabled={testingMonday}
                  >
                    {testingMonday ? 'Testando...' : 'Testar Conexão'}
                  </button>
                </div>

                {mondayTestResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      background: mondayTestResult.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: mondayTestResult.valid ? '#34d399' : '#f87171',
                      border: `1px solid ${mondayTestResult.valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {mondayTestResult.message}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">ID do Quadro (Board ID)</label>
                    <input
                      className="form-input"
                      placeholder="Ex: 1234567890"
                      value={boardId}
                      onChange={e => setBoardId(e.target.value)}
                    />
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfigureExistingBoard}
                      disabled={configuringBoard || !boardId.trim()}
                    >
                      <Sliders size={16} />
                      {configuringBoard ? 'Configurando Colunas no Quadro...' : 'Configurar Colunas neste Quadro'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleProvisionBoard}
                      disabled={provisioning}
                    >
                      <Layers size={16} />
                      {provisioning ? 'Criando Quadro Novo...' : 'Ou Criar um Quadro Novo do Zero (1 Clique)'}
                    </button>
                  </div>

                  {configBoardResult && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      {configBoardResult}
                    </div>
                  )}

                  {provisionResult && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      {provisionResult}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'alerts' && (
              <>
                <div className="form-group">
                  <label className="form-label">Limiar de Alerta (Dias Restantes) *</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    required
                    className="form-input"
                    value={thresholdDays}
                    onChange={e => setThresholdDays(parseInt(e.target.value, 10) || 2)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Quando a autonomia de um cliente atingir {thresholdDays} dias ou menos, o sistema o moverá para
                    "Alerta / Próximo de Esgotar" e enviará o e-mail matinal com destaque.
                  </span>
                </div>
              </>
            )}

            {activeTab === 'email' && (
              <>
                <div className="form-group">
                  <label className="form-label">E-mails da Equipe Unificada (separados por vírgula) *</label>
                  <input
                    className="form-input"
                    placeholder="gestor@agencia.com, colab1@agencia.com, colab2@agencia.com"
                    value={teamEmails}
                    onChange={e => setTeamEmails(e.target.value)}
                  />
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Os 3 colaboradores cadastrados aqui receberão todos os alertas matinais consolidados.
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Servidor SMTP</label>
                    <input
                      className="form-input"
                      placeholder="smtp.gmail.com"
                      value={smtpHost}
                      onChange={e => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Porta</label>
                    <input
                      type="number"
                      className="form-input"
                      value={smtpPort}
                      onChange={e => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Usuário SMTP / E-mail</label>
                    <input
                      className="form-input"
                      placeholder="seu-email@gmail.com"
                      value={smtpUser}
                      onChange={e => setSmtpUser(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Senha / App Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Senha do app ou token SMTP"
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remetente (From)</label>
                  <input
                    className="form-input"
                    placeholder="Alerta de Saldo Meta Ads <seu-email@gmail.com>"
                    value={smtpFrom}
                    onChange={e => setSmtpFrom(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeTab === 'calendar' && (
              <>
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#ffffff' }}>
                    📅 Link de Inscrição iCal (.ics) no Google Calendar
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                    Qualquer um dos 3 membros da equipe pode adicionar este link direto no Google Calendar (desktop ou celular).
                    Os eventos e datas de recarga ficarão sempre sincronizados com lembrete automático!
                  </p>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      readOnly
                      className="form-input"
                      style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                      value={settings?.icalFeedUrl || `${window.location.origin}/api/calendar/feed.ics`}
                    />
                    <button type="button" className="btn btn-secondary" onClick={copyFeedLink}>
                      {copiedFeed ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                      {copiedFeed ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Como adicionar no Google Calendar:</strong>
                  <ol style={{ paddingLeft: '20px', marginTop: '6px', lineHeight: 1.6 }}>
                    <li>Abra o Google Agenda no navegador.</li>
                    <li>Ao lado de "Outras agendas", clique no botão <strong>+</strong> e selecione <strong>"Do URL"</strong>.</li>
                    <li>Cole o link copiado acima e clique em <strong>"Adicionar agenda"</strong>.</li>
                  </ol>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {saveSuccess && (
              <span style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={16} /> Salvo com sucesso!
              </span>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Gravando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
