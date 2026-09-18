import { ClientData, RechargeStatus } from '../types.js';
import { BalanceService } from './balance.service.js';

export class MondayService {
  private apiUrl = 'https://api.monday.com/v2';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async graphqlQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Chave de API do Monday.com (MONDAY_API_KEY) não configurada.');
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro na requisição ao Monday.com (${response.status}): ${text}`);
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Erro retornado pelo Monday.com: ${data.errors.map((e: any) => e.message).join('; ')}`);
    }

    return data.data;
  }

  /**
   * Testa a validade da API Key
   */
  async testConnection(): Promise<{ valid: boolean; user?: { id: string; name: string; email: string } }> {
    try {
      const res = await this.graphqlQuery('query { me { id name email } }');
      return { valid: true, user: res.me };
    } catch (err: any) {
      return { valid: false };
    }
  }

  /**
   * Cria e provisiona um novo quadro dedicado no Monday.com com todas as colunas
   */
  async provisionBoard(boardName: string = 'Controle de Saldo Meta Ads'): Promise<{ boardId: string; columns: Record<string, string> }> {
    // 1. Cria o quadro
    const createBoardMutation = `
      mutation ($boardName: String!) {
        create_board (board_name: $boardName, board_kind: public) {
          id
        }
      }
    `;
    const boardRes = await this.graphqlQuery(createBoardMutation, { boardName });
    const boardId = boardRes.create_board.id;

    // 2. Colunas necessárias
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

    const columnIds: Record<string, string> = {};

    for (const col of columnDefinitions) {
      try {
        const addColMutation = `
          mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) {
            create_column(board_id: $boardId, title: $title, column_type: $columnType) {
              id
              title
            }
          }
        `;
        const colRes = await this.graphqlQuery(addColMutation, {
          boardId,
          title: col.title,
          columnType: col.type
        });
        columnIds[col.title] = colRes.create_column.id;
      } catch (err) {
        console.warn(`Aviso ao criar coluna "${col.title}":`, err);
      }
    }

    return { boardId, columns: columnIds };
  }

  /**
   * Adiciona as colunas necessárias de tráfego a um quadro existente do Monday
   */
  async provisionExistingBoard(boardId: string): Promise<{ added: string[]; existing: string[] }> {
    const currentColumns = await this.getBoardColumns(boardId);
    const existingTitles = currentColumns.map(c => c.title.trim().toLowerCase());

    const columnDefinitions = [
      { title: 'Pessoa', type: 'people' },
      { title: 'Status da Recarga', type: 'status' },
      { title: 'Orçamento Mensal', type: 'numbers' },
      { title: 'Gasto Diário Médio', type: 'numbers' },
      { title: 'Previsão de Esgotamento', type: 'date' },
      { title: 'Dias Restantes', type: 'numbers' },
      { title: 'Data do Último Pix', type: 'date' },
      { title: 'Valor do Último Pix', type: 'numbers' }
    ];

    const added: string[] = [];
    const alreadyPresent: string[] = [];

    for (const col of columnDefinitions) {
      const match = existingTitles.find(t => t === col.title.toLowerCase() || t.includes(col.title.toLowerCase()));
      if (match) {
        alreadyPresent.push(col.title);
      } else {
        try {
          const addColMutation = `
            mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) {
              create_column(board_id: $boardId, title: $title, column_type: $columnType) {
                id
                title
              }
            }
          `;
          await this.graphqlQuery(addColMutation, {
            boardId,
            title: col.title,
            columnType: col.type
          });
          added.push(col.title);
        } catch (err) {
          console.warn(`Aviso ao criar coluna "${col.title}":`, err);
        }
      }
    }

    return { added, existing: alreadyPresent };
  }

  /**
   * Obtém a lista de colunas do quadro para mapeamento
   */
  async getBoardColumns(boardId: string): Promise<Array<{ id: string; title: string; type: string }>> {
    const query = `
      query ($boardId: [ID!]) {
        boards (ids: $boardId) {
          columns {
            id
            title
            type
          }
        }
      }
    `;
    const res = await this.graphqlQuery(query, { boardId: [boardId] });
    return res.boards?.[0]?.columns || [];
  }

  /**
   * Lista todos os clientes do quadro e normaliza seus dados
   */
  async listClients(boardId: string, alertThresholdDays: number = 2): Promise<ClientData[]> {
    if (!boardId) return [];

    const query = `
      query ($boardId: [ID!]) {
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
      }
    `;

    const res = await this.graphqlQuery(query, { boardId: [boardId] });
    const items = res.boards?.[0]?.items_page?.items || [];

    // Mapeamento das colunas
    const columns = await this.getBoardColumns(boardId);
    const colMap: Record<string, string> = {};
    for (const col of columns) {
      colMap[col.id] = col.title.trim().toLowerCase();
    }

    const clients: ClientData[] = items.map((item: any) => {
      let person = '';
      let metaAccountId = '';
      let monthlyBudget = 0;
      let dailySpend = 0;
      let lastPixDate = '';
      let lastPixValue = 0;
      let depletionDate = '';
      let remainingDays = 0;
      let status: RechargeStatus = 'Saldo Saudável';
      let pixCode = '';
      let notes = '';

      for (const cv of item.column_values) {
        const title = colMap[cv.id] || '';
        const textVal = cv.text ? cv.text.trim() : '';
        if (!textVal) continue;

        if (title.includes('pessoa') || title.includes('people') || cv.type === 'people') {
          person = textVal;
        } else if (title.includes('id da conta') || title.includes('meta')) {
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
          if (textVal) status = textVal as RechargeStatus;
        } else if (title.includes('código') || title.includes('link') || title.includes('codigo')) {
          pixCode = textVal;
        } else if (title.includes('anotações') || title.includes('anotacoes') || title.includes('obs')) {
          notes = textVal;
        }
      }

      // Calcula a previsão em tempo real
      const forecast = BalanceService.calculateForecast(
        lastPixDate,
        lastPixValue,
        monthlyBudget,
        dailySpend,
        status,
        alertThresholdDays
      );

      return {
        id: item.id,
        name: item.name,
        person,
        metaAccountId,
        monthlyBudget,
        dailySpend: forecast.dailySpend,
        lastPixDate,
        lastPixValue,
        depletionDate: forecast.depletionDate,
        remainingDays: forecast.remainingDays,
        status: (status === 'Saldo Saudável' && forecast.suggestedStatus !== 'Saldo Saudável')
          ? forecast.suggestedStatus
          : status,
        pixCode,
        notes,
        updatedAt: item.updated_at
      };
    });

    return clients;
  }

  /**
   * Cria um novo cliente no Monday
   */
  async createClient(boardId: string, client: Partial<ClientData>): Promise<{ id: string }> {
    const columns = await this.getBoardColumns(boardId);
    const colByTitle: Record<string, any> = {};
    for (const c of columns) {
      colByTitle[c.title.trim().toLowerCase()] = c;
    }

    const columnValues: Record<string, any> = {};

    const findCol = (predicate: (t: string) => boolean) => {
      for (const [title, col] of Object.entries(colByTitle)) {
        if (predicate(title)) return col.id;
      }
      return null;
    };

    const idMetaCol = findCol(t => t.includes('id da conta') || t.includes('meta'));
    if (idMetaCol && client.metaAccountId) columnValues[idMetaCol] = client.metaAccountId;

    const orcamentoCol = findCol(t => t.includes('orçamento mensal') || t.includes('orcamento'));
    if (orcamentoCol && client.monthlyBudget !== undefined) columnValues[orcamentoCol] = client.monthlyBudget.toString();

    const gastoCol = findCol(t => t.includes('gasto diário') || t.includes('gasto diario'));
    if (gastoCol && client.dailySpend !== undefined) columnValues[gastoCol] = client.dailySpend.toString();

    const dataPixCol = findCol(t => t.includes('data') && t.includes('pix'));
    if (dataPixCol && client.lastPixDate) {
      columnValues[dataPixCol] = { date: client.lastPixDate };
    }

    const valorPixCol = findCol(t => t.includes('valor') && t.includes('pix'));
    if (valorPixCol && client.lastPixValue !== undefined) columnValues[valorPixCol] = client.lastPixValue.toString();

    const statusCol = findCol(t => t.includes('status'));
    if (statusCol && client.status) {
      columnValues[statusCol] = { label: client.status };
    }

    const pixCodeCol = findCol(t => t.includes('código') || t.includes('link') || t.includes('codigo'));
    if (pixCodeCol && client.pixCode) columnValues[pixCodeCol] = client.pixCode;

    const notesCol = findCol(t => t.includes('anotações') || t.includes('anotacoes') || t.includes('obs'));
    if (notesCol && client.notes) {
      columnValues[notesCol] = { text: client.notes };
    }

    const mutation = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues, create_labels_if_missing: true) {
          id
        }
      }
    `;

    const res = await this.graphqlQuery(mutation, {
      boardId,
      itemName: client.name || 'Novo Cliente',
      columnValues: JSON.stringify(columnValues)
    });

    return { id: res.create_item.id };
  }

  /**
   * Atualiza o status do cliente no Monday
   */
  async updateStatus(boardId: string, itemId: string, status: RechargeStatus): Promise<void> {
    const columns = await this.getBoardColumns(boardId);
    const statusCol = columns.find(c => c.type === 'status' || c.title.toLowerCase().includes('status'));
    if (!statusCol) return;

    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values (
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues,
          create_labels_if_missing: true
        ) {
          id
        }
      }
    `;

    await this.graphqlQuery(mutation, {
      boardId,
      itemId,
      columnValues: JSON.stringify({ [statusCol.id]: { label: status } })
    });
  }

  /**
   * Atualiza dados do cliente no Monday
   */
  async updateClient(boardId: string, itemId: string, updates: Partial<ClientData>): Promise<void> {
    const columns = await this.getBoardColumns(boardId);
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
    if (updates.depletionDate !== undefined) {
      const colId = findCol(t => t.includes('esgotamento') || t.includes('previsão') || t.includes('previsao'));
      if (colId) columnValues[colId] = { date: updates.depletionDate };
    }
    if (updates.remainingDays !== undefined) {
      const colId = findCol(t => t.includes('dias restantes'));
      if (colId) columnValues[colId] = updates.remainingDays.toString();
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

    if (Object.keys(columnValues).length === 0) return;

    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values (
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues,
          create_labels_if_missing: true
        ) {
          id
        }
      }
    `;

    if (Object.keys(columnValues).length > 0) {
      await this.graphqlQuery(mutation, {
        boardId,
        itemId,
        columnValues: JSON.stringify(columnValues)
      });
    }

    if (updates.name && updates.name.trim()) {
      const renameMutation = `
        mutation ($boardId: ID!, $itemId: ID!, $name: String!) {
          change_simple_column_value (board_id: $boardId, item_id: $itemId, column_id: "name", value: $name) {
            id
          }
        }
      `;
      await this.graphqlQuery(renameMutation, {
        boardId,
        itemId,
        name: updates.name.trim()
      });
    }
  }

  /**
   * Registra novo Pix, calcula nova autonomia e confirma saldo
   */
  async recordPixPayment(
    boardId: string,
    itemId: string,
    pixValue: number,
    pixDate: string,
    monthlyBudget: number,
    dailySpendManual?: number
  ): Promise<void> {
    const forecast = BalanceService.calculateForecast(
      pixDate,
      pixValue,
      monthlyBudget,
      dailySpendManual,
      'Saldo Confirmado'
    );

    await this.updateClient(boardId, itemId, {
      lastPixDate: pixDate,
      lastPixValue: pixValue,
      dailySpend: forecast.dailySpend,
      depletionDate: forecast.depletionDate,
      remainingDays: forecast.remainingDays,
      status: 'Saldo Confirmado'
    });
  }
}
