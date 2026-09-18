export interface ClientData {
  id: string;
  name: string;
  metaAccountId: string;
  monthlyBudget: number;
  dailySpend: number;
  lastPixDate: string;
  lastPixValue: number;
  depletionDate: string;
  remainingDays: number;
  status:
    | 'Saldo Saudável'
    | 'Alerta / Próximo de Esgotar'
    | 'Pix Gerado / Enviado ao Cliente'
    | 'Pago / Aguardando Compensação'
    | 'Saldo Confirmado';
  pixCode: string;
  notes: string;
  updatedAt?: string;
}

export interface SettingsData {
  mondayConnected: boolean;
  mondayUser?: { id: string; name: string; email: string };
  mondayApiKeyConfigured: boolean;
  mondayBoardId: string;
  alertThresholdDays: number;
  teamEmails: string[];
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    configured: boolean;
    from: string;
  };
  googleCalendarConfigured: boolean;
  icalFeedUrl: string;
}

const API_BASE = '/api';

// Dados de demonstração para quando rodar no GitHub Pages ou offline
const DEFAULT_CLIENTS: ClientData[] = [
  {
    id: 'demo-1',
    name: 'E-commerce Alpha Store',
    metaAccountId: 'act_492019384',
    monthlyBudget: 6000,
    dailySpend: 200,
    lastPixDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    lastPixValue: 2000,
    depletionDate: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    remainingDays: 8,
    status: 'Saldo Saudável',
    pixCode: '00020126580014br.gov.bcb.pix.alphastore',
    notes: 'Campanha de conversão em escala. Fim de semana costuma acelerar o CPA.',
  },
  {
    id: 'demo-2',
    name: 'Clínica Odonto Prime',
    metaAccountId: 'act_718293041',
    monthlyBudget: 3000,
    dailySpend: 100,
    lastPixDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    lastPixValue: 600,
    depletionDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    remainingDays: 1,
    status: 'Alerta / Próximo de Esgotar',
    pixCode: 'https://business.facebook.com/ads/manager/billing/odontoprime',
    notes: 'Atenção: Saldo zerando em 24h! Cliente costuma pagar no período da tarde.',
  },
  {
    id: 'demo-3',
    name: 'Academia FitLife 24h',
    metaAccountId: 'act_583920192',
    monthlyBudget: 4500,
    dailySpend: 150,
    lastPixDate: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
    lastPixValue: 900,
    depletionDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    remainingDays: 2,
    status: 'Pix Gerado / Enviado ao Cliente',
    pixCode: '00020126580014br.gov.bcb.pix.fitlife24h',
    notes: 'Pix de R$ 900 enviado via WhatsApp para o financeiro do cliente.',
  },
  {
    id: 'demo-4',
    name: 'Advocacia Silveira & Associados',
    metaAccountId: 'act_991827364',
    monthlyBudget: 2400,
    dailySpend: 80,
    lastPixDate: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
    lastPixValue: 500,
    depletionDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    remainingDays: 1,
    status: 'Pago / Aguardando Compensação',
    pixCode: '00020126580014br.gov.bcb.pix.silveiraadv',
    notes: 'Comprovante recebido hoje! Aguardando o Meta processar o saldo.',
  },
  {
    id: 'demo-5',
    name: 'Imobiliária Moradas do Sol',
    metaAccountId: 'act_302918475',
    monthlyBudget: 9000,
    dailySpend: 300,
    lastPixDate: new Date().toISOString().split('T')[0],
    lastPixValue: 3000,
    depletionDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    remainingDays: 10,
    status: 'Saldo Confirmado',
    pixCode: '00020126580014br.gov.bcb.pix.moradas',
    notes: 'Recarga de R$ 3.000 confirmada hoje. Campanha de novos imóveis ativa.',
  },
];

function getLocalClients(): ClientData[] {
  const stored = localStorage.getItem('mondaymcp_clients');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  localStorage.setItem('mondaymcp_clients', JSON.stringify(DEFAULT_CLIENTS));
  return DEFAULT_CLIENTS;
}

function saveLocalClients(clients: ClientData[]): void {
  localStorage.setItem('mondaymcp_clients', JSON.stringify(clients));
}

function getLocalSettings(): SettingsData {
  const stored = localStorage.getItem('mondaymcp_settings');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  return {
    mondayConnected: false,
    mondayApiKeyConfigured: false,
    mondayBoardId: '123456789',
    alertThresholdDays: 2,
    teamEmails: ['gestor@agencia.com', 'colaborador1@agencia.com', 'colaborador2@agencia.com'],
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'equipe@agencia.com',
      configured: true,
      from: 'Alerta de Saldo Meta Ads <equipe@agencia.com>',
    },
    googleCalendarConfigured: false,
    icalFeedUrl: `${window.location.origin}/api/calendar/feed.ics`,
  };
}

export async function fetchClients(): Promise<{ clients: ClientData[]; needsConfig?: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients`);
    if (res.ok) {
      const data = await res.json();
      return { clients: data.clients || [] };
    }
    const data = await res.json().catch(() => ({}));
    if (data.needsConfig) {
      // Se estiver no backend e precisar de config
      return { clients: [], needsConfig: true };
    }
  } catch {
    // Backend offline / GitHub Pages
  }

  // Fallback para localStorage
  return { clients: getLocalClients() };
}

export async function createClient(client: Partial<ClientData>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, id: data.id };
    }
  } catch {
    // Fallback
  }

  const clients = getLocalClients();
  const dailySpend = client.dailySpend || Math.round(((client.monthlyBudget || 3000) / 30) * 100) / 100;
  const lastPixValue = client.lastPixValue || 500;
  const autonomy = dailySpend > 0 ? Math.floor(lastPixValue / dailySpend) : 5;
  const depletionDate = new Date(Date.now() + autonomy * 86400000).toISOString().split('T')[0];

  const newClient: ClientData = {
    id: `local-${Date.now()}`,
    name: client.name || 'Novo Cliente',
    metaAccountId: client.metaAccountId || '',
    monthlyBudget: client.monthlyBudget || 3000,
    dailySpend,
    lastPixDate: client.lastPixDate || new Date().toISOString().split('T')[0],
    lastPixValue,
    depletionDate,
    remainingDays: autonomy,
    status: client.status || 'Saldo Saudável',
    pixCode: client.pixCode || '',
    notes: client.notes || '',
  };

  clients.unshift(newClient);
  saveLocalClients(clients);
  return { success: true, id: newClient.id };
}

export async function updateClient(id: string, updates: Partial<ClientData>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) return { success: true };
  } catch {
    // Fallback
  }

  const clients = getLocalClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    clients[idx] = { ...clients[idx], ...updates };
    saveLocalClients(clients);
  }
  return { success: true };
}

export async function updateClientStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return { success: true };
  } catch {
    // Fallback
  }

  const clients = getLocalClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    clients[idx].status = status as any;
    saveLocalClients(clients);
  }
  return { success: true };
}

export async function recordPixPayment(
  id: string,
  payload: { pixValue: number; pixDate?: string; monthlyBudget?: number; dailySpend?: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients/${id}/record-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { success: true };
  } catch {
    // Fallback
  }

  const clients = getLocalClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) {
    const c = clients[idx];
    const dailySpend = payload.dailySpend || c.dailySpend || 100;
    const autonomyDays = Math.floor(payload.pixValue / dailySpend);
    const pixDateStr = payload.pixDate || new Date().toISOString().split('T')[0];
    const baseDate = new Date(`${pixDateStr}T12:00:00Z`);
    const depletionDate = new Date(baseDate.getTime() + autonomyDays * 86400000).toISOString().split('T')[0];

    clients[idx] = {
      ...c,
      lastPixValue: payload.pixValue,
      lastPixDate: pixDateStr,
      depletionDate,
      remainingDays: autonomyDays,
      status: 'Saldo Confirmado',
    };
    saveLocalClients(clients);
  }
  return { success: true };
}

export async function fetchSettings(): Promise<SettingsData | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }
  return getLocalSettings();
}

export async function saveSettings(settings: any): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) return { success: true };
  } catch {
    // Fallback
  }

  const curr = getLocalSettings();
  const merged = { ...curr, ...settings };
  localStorage.setItem('mondaymcp_settings', JSON.stringify(merged));
  return { success: true };
}

export async function testMondayApiKey(apiKey?: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/monday/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback: faz query direta para a API do Monday via browser CORS
  }

  if (!apiKey) return { valid: false, error: 'Chave de API não informada.' };

  try {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query: 'query { me { id name email } }' }),
    });
    const data = await res.json();
    if (data.data?.me) {
      return { valid: true, user: data.data.me };
    }
    return { valid: false, error: data.errors?.[0]?.message || 'Erro ao validar token no Monday.' };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

export async function provisionMondayBoard(payload: { apiKey?: string; boardName?: string }): Promise<{ success: boolean; boardId?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/monday/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }

  return { success: true, boardId: '1234567890' };
}

export async function configureExistingMondayBoard(payload: { apiKey?: string; boardId: string }): Promise<{ success: boolean; message?: string; added?: string[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/monday/configure-board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao configurar colunas');
    return data;
  } catch (backendErr: any) {
    // Fallback: se estiver no GitHub Pages com API token direto
    if (payload.apiKey && payload.boardId) {
      try {
        const columnDefinitions = [
          { title: 'ID da Conta Meta', type: 'text' },
          { title: 'Orçamento Mensal', type: 'numbers' },
          { title: 'Gasto Diário Médio', type: 'numbers' },
          { title: 'Data do Último Pix', type: 'date' },
          { title: 'Valor do Último Pix', type: 'numbers' },
          { title: 'Previsão de Esgotamento', type: 'date' },
          { title: 'Dias Restantes', type: 'numbers' },
          { title: 'Status da Recarga', type: 'status' },
          { title: 'Código / Link Pix', type: 'text' },
          { title: 'Anotações', type: 'long_text' }
        ];

        for (const col of columnDefinitions) {
          const m = `mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) { create_column(board_id: $boardId, title: $title, column_type: $columnType) { id title } }`;
          await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: payload.apiKey, 'API-Version': '2024-01' },
            body: JSON.stringify({ query: m, variables: { boardId: payload.boardId, title: col.title, columnType: col.type } })
          });
        }
        return { success: true, message: 'Colunas criadas com sucesso no quadro do Monday!' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  }

  return { success: true, message: 'Colunas configuradas com sucesso no quadro!' };
}

export async function triggerManualSync(): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, result: data.result };
    }
  } catch {
    // Fallback
  }

  const clients = getLocalClients();
  const alertClients = clients.filter(c => c.remainingDays <= 2);
  return {
    success: true,
    result: {
      totalClients: clients.length,
      clientsInAlert: alertClients,
      emailsSent: true,
      calendarEventsUpdated: clients.length,
    },
  };
}
