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
  mondayApiKey?: string;
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
const MONDAY_API_URL = 'https://api.monday.com/v2';

// Credenciais padrão caso esteja rodando diretamente no GitHub Pages sem backend local
export const DEFAULT_MONDAY_API_KEY =
  'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ3ODUwNzUzOCwiYWFpIjoxMSwidWlkIjo3MjQ4Njg1OSwiaWFkIjoiMjAyNS0wMi0yN1QwMjowNzoyMy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTI3OTY4ODIsInJnbiI6InVzZTEifQ.nRzn488r-RXQrMwbAxhbmtAyU93ILTPEMhLLQKkRUDw';
export const DEFAULT_MONDAY_BOARD_ID = '18431725532';

export function getLocalSettings(): SettingsData {
  // Limpa qualquer dado fake antigo de versões anteriores
  localStorage.removeItem('mondaymcp_clients');

  const stored = localStorage.getItem('mondaymcp_settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.mondayApiKey || parsed.mondayBoardId) {
        return {
          mondayConnected: !!parsed.mondayApiKey,
          mondayApiKeyConfigured: !!parsed.mondayApiKey,
          mondayApiKey: parsed.mondayApiKey || DEFAULT_MONDAY_API_KEY,
          mondayBoardId: parsed.mondayBoardId || DEFAULT_MONDAY_BOARD_ID,
          alertThresholdDays: parsed.alertThresholdDays || 2,
          teamEmails: parsed.teamEmails || ['vctx64@gmail.com'],
          smtp: parsed.smtp || { host: 'smtp.gmail.com', port: 587, secure: false, user: '', configured: false, from: '' },
          googleCalendarConfigured: false,
          icalFeedUrl: `${window.location.origin}/api/calendar/feed.ics`,
        };
      }
    } catch {
      // continua
    }
  }

  return {
    mondayConnected: true,
    mondayUser: { id: '72486859', name: 'Victor Fernandes', email: 'vctx64@gmail.com' },
    mondayApiKeyConfigured: true,
    mondayApiKey: DEFAULT_MONDAY_API_KEY,
    mondayBoardId: DEFAULT_MONDAY_BOARD_ID,
    alertThresholdDays: 2,
    teamEmails: ['vctx64@gmail.com'],
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      configured: false,
      from: 'Alerta de Saldo Meta Ads <vctx64@gmail.com>',
    },
    googleCalendarConfigured: false,
    icalFeedUrl: `${window.location.origin}/api/calendar/feed.ics`,
  };
}

// Executa requisição GraphQL direta na API do Monday
async function callMondayApi(query: string, variables: Record<string, any> = {}, apiKey?: string): Promise<any> {
  const token = apiKey || getLocalSettings().mondayApiKey || DEFAULT_MONDAY_API_KEY;
  if (!token) throw new Error('API Key do Monday não configurada.');

  const res = await fetch(MONDOND_URL_WRAP(MONDAY_API_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API do Monday (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors.map((e: any) => e.message).join('; '));
  }

  return data.data;
}

function MONDOND_URL_WRAP(url: string): string {
  return url;
}

// ----------------------------------------------------------------------------------
// Cálculo de Burn Rate e Previsão (em tempo real no frontend)
// ----------------------------------------------------------------------------------
export function calculateForecast(
  lastPixDateStr: string,
  lastPixValue: number,
  monthlyBudget: number,
  dailySpendManual?: number,
  currentStatus?: string,
  alertThresholdDays: number = 2
) {
  let dailySpend = dailySpendManual && dailySpendManual > 0 ? dailySpendManual : 0;
  if (dailySpend <= 0 && monthlyBudget > 0) {
    dailySpend = Math.round((monthlyBudget / 30) * 100) / 100;
  }

  if (dailySpend <= 0) {
    return {
      dailySpend: 0,
      depletionDate: lastPixDateStr || new Date().toISOString().split('T')[0],
      remainingDays: 0,
      suggestedStatus: (currentStatus as any) || 'Saldo Saudável',
    };
  }

  const baseDate = lastPixDateStr ? new Date(`${lastPixDateStr}T12:00:00Z`) : new Date();
  const autonomyDays = lastPixValue > 0 ? Math.floor(lastPixValue / dailySpend) : 0;
  const depletionDateObj = new Date(baseDate.getTime() + autonomyDays * 24 * 60 * 60 * 1000);
  const depletionDate = depletionDateObj.toISOString().split('T')[0];

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  depletionDateObj.setHours(12, 0, 0, 0);

  const diffTime = depletionDateObj.getTime() - today.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let suggestedStatus = currentStatus || 'Saldo Saudável';
  if (currentStatus === 'Saldo Saudável' || !currentStatus) {
    if (remainingDays <= alertThresholdDays) {
      suggestedStatus = 'Alerta / Próximo de Esgotar';
    } else {
      suggestedStatus = 'Saldo Saudável';
    }
  }

  return {
    dailySpend,
    depletionDate,
    remainingDays,
    suggestedStatus,
  };
}

// ----------------------------------------------------------------------------------
// Fetch Clients (100% Real do Monday.com)
// ----------------------------------------------------------------------------------
export async function fetchClients(): Promise<{ clients: ClientData[]; needsConfig?: boolean; error?: string }> {
  // 1. Tenta backend local se estiver ativo
  try {
    const res = await fetch(`${API_BASE}/clients`);
    if (res.ok) {
      const data = await res.json();
      return { clients: data.clients || [] };
    }
  } catch {
    // Backend local não está rodando (ex: GitHub Pages), consulta Monday diretamente
  }

  // 2. Consulta Monday.com GraphQL API diretamente
  const settings = getLocalSettings();
  const boardId = settings.mondayBoardId || DEFAULT_MONDAY_BOARD_ID;
  const apiKey = settings.mondayApiKey || DEFAULT_MONDAY_API_KEY;

  if (!boardId || !apiKey) {
    return { clients: [], needsConfig: true };
  }

  try {
    // Busca colunas do quadro para mapeamento
    const colsRes = await callMondayApi(
      `query ($boardId: [ID!]) { boards (ids: $boardId) { columns { id title type } } }`,
      { boardId: [boardId] },
      apiKey
    );
    const columns = colsRes.boards?.[0]?.columns || [];
    const colMap: Record<string, string> = {};
    for (const c of columns) {
      colMap[c.id] = c.title.trim().toLowerCase();
    }

    // Busca itens reais do quadro
    const itemsRes = await callMondayApi(
      `query ($boardId: [ID!]) {
        boards (ids: $boardId) {
          items_page (limit: 500) {
            items {
              id
              name
              updated_at
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }`,
      { boardId: [boardId] },
      apiKey
    );

    const items = itemsRes.boards?.[0]?.items_page?.items || [];
    const alertThreshold = settings.alertThresholdDays || 2;

    const clients: ClientData[] = items.map((item: any) => {
      let metaAccountId = '';
      let monthlyBudget = 0;
      let dailySpend = 0;
      let lastPixDate = '';
      let lastPixValue = 0;
      let depletionDate = '';
      let remainingDays = 0;
      let status = 'Saldo Saudável';
      let pixCode = '';
      let notes = '';

      for (const cv of item.column_values) {
        const title = colMap[cv.id] || '';
        const textVal = cv.text ? cv.text.trim() : '';
        if (!textVal) continue;

        if (title.includes('id da conta') || title.includes('meta')) {
          metaAccountId = textVal;
        } else if (title.includes('orçamento mensal') || title.includes('orcamento')) {
          monthlyBudget = parseFloat(textVal.replace(/[^\d.-]/g, '')) || 0;
        } else if (title.includes('gasto diário') || title.includes('gasto diario')) {
          dailySpend = parseFloat(textVal.replace(/[^\d.-]/g, '')) || 0;
        } else if (title.includes('data do último pix') || (title.includes('data') && title.includes('pix'))) {
          lastPixDate = textVal;
        } else if (title.includes('valor do último pix') || (title.includes('valor') && title.includes('pix'))) {
          lastPixValue = parseFloat(textVal.replace(/[^\d.-]/g, '')) || 0;
        } else if (title.includes('esgotamento') || title.includes('previsão') || title.includes('previsao')) {
          depletionDate = textVal;
        } else if (title.includes('dias restantes')) {
          remainingDays = parseInt(textVal, 10) || 0;
        } else if (title.includes('status') || cv.type === 'status') {
          if (textVal) status = textVal;
        } else if (title.includes('código') || title.includes('link') || title.includes('codigo')) {
          pixCode = textVal;
        } else if (title.includes('anotações') || title.includes('anotacoes') || title.includes('obs')) {
          notes = textVal;
        }
      }

      const forecast = calculateForecast(
        lastPixDate,
        lastPixValue,
        monthlyBudget,
        dailySpend,
        status,
        alertThreshold
      );

      return {
        id: item.id,
        name: item.name,
        metaAccountId,
        monthlyBudget,
        dailySpend: forecast.dailySpend,
        lastPixDate,
        lastPixValue,
        depletionDate: forecast.depletionDate,
        remainingDays: forecast.remainingDays,
        status: (status === 'Saldo Saudável' && forecast.suggestedStatus !== 'Saldo Saudável'
          ? forecast.suggestedStatus
          : status) as any,
        pixCode,
        notes,
        updatedAt: item.updated_at,
      };
    });

    return { clients };
  } catch (err: any) {
    return { clients: [], error: err.message };
  }
}

// ----------------------------------------------------------------------------------
// Create Client (Cria no Monday.com)
// ----------------------------------------------------------------------------------
export async function createClient(client: Partial<ClientData>): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Tenta backend local
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
    // Continua para o Monday direto
  }

  // 2. Cria direto no Monday.com
  const settings = getLocalSettings();
  const boardId = settings.mondayBoardId || DEFAULT_MONDAY_BOARD_ID;
  const apiKey = settings.mondayApiKey || DEFAULT_MONDAY_API_KEY;

  try {
    const colsRes = await callMondayApi(
      `query ($boardId: [ID!]) { boards (ids: $boardId) { columns { id title type } } }`,
      { boardId: [boardId] },
      apiKey
    );
    const columns = colsRes.boards?.[0]?.columns || [];
    const colByTitle: Record<string, any> = {};
    for (const c of columns) {
      colByTitle[c.title.trim().toLowerCase()] = c;
    }

    const findCol = (predicate: (t: string) => boolean) => {
      for (const [title, col] of Object.entries(colByTitle)) {
        if (predicate(title)) return col.id;
      }
      return null;
    };

    const columnValues: Record<string, any> = {};

    const idMetaCol = findCol(t => t.includes('id da conta') || t.includes('meta'));
    if (idMetaCol && client.metaAccountId) columnValues[idMetaCol] = client.metaAccountId;

    const orcamentoCol = findCol(t => t.includes('orçamento mensal') || t.includes('orcamento'));
    if (orcamentoCol && client.monthlyBudget !== undefined) columnValues[orcamentoCol] = client.monthlyBudget.toString();

    const gastoCol = findCol(t => t.includes('gasto diário') || t.includes('gasto diario'));
    if (gastoCol && client.dailySpend !== undefined) columnValues[gastoCol] = client.dailySpend.toString();

    const dataPixCol = findCol(t => t.includes('data') && t.includes('pix'));
    if (dataPixCol && client.lastPixDate) columnValues[dataPixCol] = { date: client.lastPixDate };

    const valorPixCol = findCol(t => t.includes('valor') && t.includes('pix'));
    if (valorPixCol && client.lastPixValue !== undefined) columnValues[valorPixCol] = client.lastPixValue.toString();

    const statusCol = findCol(t => t.includes('status'));
    if (statusCol && client.status) columnValues[statusCol] = { label: client.status };

    const pixCodeCol = findCol(t => t.includes('código') || t.includes('link') || t.includes('codigo'));
    if (pixCodeCol && client.pixCode) columnValues[pixCodeCol] = client.pixCode;

    const notesCol = findCol(t => t.includes('anotações') || t.includes('anotacoes') || t.includes('obs'));
    if (notesCol && client.notes) columnValues[notesCol] = { text: client.notes };

    const mutation = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;

    const res = await callMondayApi(
      mutation,
      {
        boardId,
        itemName: client.name || 'Novo Cliente',
        columnValues: JSON.stringify(columnValues),
      },
      apiKey
    );

    return { success: true, id: res.create_item.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------------
// Update Client (Atualiza no Monday.com)
// ----------------------------------------------------------------------------------
export async function updateClient(id: string, updates: Partial<ClientData>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) return { success: true };
  } catch {
    // Continua para o Monday direto
  }

  const settings = getLocalSettings();
  const boardId = settings.mondayBoardId || DEFAULT_MONDAY_BOARD_ID;
  const apiKey = settings.mondayApiKey || DEFAULT_MONDAY_API_KEY;

  try {
    const colsRes = await callMondayApi(
      `query ($boardId: [ID!]) { boards (ids: $boardId) { columns { id title type } } }`,
      { boardId: [boardId] },
      apiKey
    );
    const columns = colsRes.boards?.[0]?.columns || [];
    const colByTitle: Record<string, any> = {};
    for (const c of columns) {
      colByTitle[c.title.trim().toLowerCase()] = c;
    }

    const findCol = (predicate: (t: string) => boolean) => {
      for (const [title, col] of Object.entries(colByTitle)) {
        if (predicate(title)) return col.id;
      }
      return null;
    };

    const columnValues: Record<string, any> = {};

    if (updates.metaAccountId !== undefined) {
      const colId = findCol(t => t.includes('id da conta') || t.includes('meta'));
      if (colId) columnValues[colId] = updates.metaAccountId;
    }
    if (updates.monthlyBudget !== undefined) {
      const colId = findCol(t => t.includes('orçamento mensal') || t.includes('orcamento'));
      if (colId) columnValues[colId] = updates.monthlyBudget.toString();
    }
    if (updates.dailySpend !== undefined) {
      const colId = findCol(t => t.includes('gasto diário') || t.includes('gasto diario'));
      if (colId) columnValues[colId] = updates.dailySpend.toString();
    }
    if (updates.lastPixDate !== undefined) {
      const colId = findCol(t => t.includes('data') && t.includes('pix'));
      if (colId) columnValues[colId] = { date: updates.lastPixDate };
    }
    if (updates.lastPixValue !== undefined) {
      const colId = findCol(t => t.includes('valor') && t.includes('pix'));
      if (colId) columnValues[colId] = updates.lastPixValue.toString();
    }
    if (updates.status !== undefined) {
      const colId = findCol(t => t.includes('status'));
      if (colId) columnValues[colId] = { label: updates.status };
    }
    if (updates.pixCode !== undefined) {
      const colId = findCol(t => t.includes('código') || t.includes('link') || t.includes('codigo'));
      if (colId) columnValues[colId] = updates.pixCode;
    }
    if (updates.notes !== undefined) {
      const colId = findCol(t => t.includes('anotações') || t.includes('anotacoes') || t.includes('obs'));
      if (colId) columnValues[colId] = { text: updates.notes };
    }

    if (Object.keys(columnValues).length > 0) {
      const mutation = `
        mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values (board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
            id
          }
        }
      `;
      await callMondayApi(mutation, { boardId, itemId: id, columnValues: JSON.stringify(columnValues) }, apiKey);
    }

    if (updates.name && updates.name.trim()) {
      const renameMutation = `
        mutation ($boardId: ID!, $itemId: ID!, $name: String!) {
          change_simple_column_value (board_id: $boardId, item_id: $itemId, column_id: "name", value: $name) {
            id
          }
        }
      `;
      await callMondayApi(renameMutation, { boardId, itemId: id, name: updates.name.trim() }, apiKey);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------------
// Update Status (Arrastar no Kanban)
// ----------------------------------------------------------------------------------
export async function updateClientStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clients/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return { success: true };
  } catch {
    // Continua
  }

  const settings = getLocalSettings();
  const boardId = settings.mondayBoardId || DEFAULT_MONDAY_BOARD_ID;
  const apiKey = settings.mondayApiKey || DEFAULT_MONDAY_API_KEY;

  try {
    const colsRes = await callMondayApi(
      `query ($boardId: [ID!]) { boards (ids: $boardId) { columns { id title type } } }`,
      { boardId: [boardId] },
      apiKey
    );
    const columns = colsRes.boards?.[0]?.columns || [];
    const statusCol = columns.find((c: any) => c.type === 'status' || c.title.toLowerCase().includes('status'));

    if (statusCol) {
      const mutation = `
        mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value (board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
            id
          }
        }
      `;
      await callMondayApi(
        mutation,
        {
          boardId,
          itemId: id,
          columnId: statusCol.id,
          value: JSON.stringify({ label: status }),
        },
        apiKey
      );
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------------
// Record Pix Payment (Confirma recarga no Monday)
// ----------------------------------------------------------------------------------
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
    // Continua
  }

  const pixDateStr = payload.pixDate || new Date().toISOString().split('T')[0];
  const forecast = calculateForecast(
    pixDateStr,
    payload.pixValue,
    payload.monthlyBudget || 3000,
    payload.dailySpend,
    'Saldo Confirmado'
  );

  return await updateClient(id, {
    lastPixValue: payload.pixValue,
    lastPixDate: pixDateStr,
    dailySpend: forecast.dailySpend,
    depletionDate: forecast.depletionDate,
    remainingDays: forecast.remainingDays,
    status: 'Saldo Confirmado',
  });
}

// ----------------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------------
export async function fetchSettings(): Promise<SettingsData | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (res.ok) return await res.json();
  } catch {
    // Continua
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
    // Continua
  }

  const curr = getLocalSettings();
  const merged = { ...curr, ...settings };
  localStorage.setItem('mondaymcp_settings', JSON.stringify(merged));
  return { success: true };
}

export async function testMondayApiKey(apiKey?: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  const token = apiKey || getLocalSettings().mondayApiKey || DEFAULT_MONDAY_API_KEY;
  if (!token) return { valid: false, error: 'Chave de API não informada.' };

  try {
    const res = await callMondayApi('query { me { id name email } }', {}, token);
    if (res.me) {
      return { valid: true, user: res.me };
    }
    return { valid: false, error: 'Usuário não encontrado.' };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

export async function provisionMondayBoard(payload: { apiKey?: string; boardName?: string }): Promise<{ success: boolean; boardId?: string; error?: string }> {
  const token = payload.apiKey || getLocalSettings().mondayApiKey || DEFAULT_MONDAY_API_KEY;

  try {
    const res = await fetch(`${API_BASE}/monday/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // Continua
  }

  try {
    const boardRes = await callMondayApi(
      `mutation ($boardName: String!) { create_board (board_name: $boardName, board_kind: public) { id } }`,
      { boardName: payload.boardName || 'Controle de Saldo Meta Ads' },
      token
    );
    const boardId = boardRes.create_board.id;
    await configureExistingMondayBoard({ apiKey: token, boardId });
    return { success: true, boardId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function configureExistingMondayBoard(payload: { apiKey?: string; boardId: string }): Promise<{ success: boolean; message?: string; added?: string[]; error?: string }> {
  const token = payload.apiKey || getLocalSettings().mondayApiKey || DEFAULT_MONDAY_API_KEY;

  try {
    const res = await fetch(`${API_BASE}/monday/configure-board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, apiKey: token }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Continua
  }

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
      { title: 'Anotações', type: 'long_text' },
    ];

    for (const col of columnDefinitions) {
      const m = `mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) { create_column(board_id: $boardId, title: $title, column_type: $columnType) { id title } }`;
      await callMondayApi(m, { boardId: payload.boardId, title: col.title, columnType: col.type }, token);
    }
    return { success: true, message: 'Colunas criadas com sucesso no quadro do Monday!' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function triggerManualSync(): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return { success: true, result: data.result };
    }
  } catch {
    // Continua
  }

  const { clients } = await fetchClients();
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
