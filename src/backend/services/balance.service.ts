import { ClientData, RechargeStatus } from '../types.js';

export class BalanceService {
  /**
   * Calcula as previsões de esgotamento e dias restantes com base no Pix e ritmo de gasto
   */
  static calculateForecast(
    lastPixDateStr: string,
    lastPixValue: number,
    monthlyBudget: number,
    dailySpendManual?: number,
    currentStatus?: RechargeStatus,
    alertThresholdDays: number = 2
  ): {
    dailySpend: number;
    depletionDate: string;
    remainingDays: number;
    suggestedStatus: RechargeStatus;
  } {
    // 1. Calcula ou valida o gasto diário
    let dailySpend = dailySpendManual && dailySpendManual > 0 ? dailySpendManual : 0;
    if (dailySpend <= 0 && monthlyBudget > 0) {
      dailySpend = Math.round((monthlyBudget / 30) * 100) / 100;
    }

    // Se ainda assim não houver gasto diário, padrão de segurança
    if (dailySpend <= 0) {
      return {
        dailySpend: 0,
        depletionDate: lastPixDateStr || new Date().toISOString().split('T')[0],
        remainingDays: 0,
        suggestedStatus: currentStatus || 'Saldo Saudável',
      };
    }

    // 2. Data base do último Pix (ou hoje se vazia)
    const baseDate = lastPixDateStr ? new Date(`${lastPixDateStr}T12:00:00Z`) : new Date();
    
    // 3. Dias de autonomia gerados pelo valor do Pix
    const autonomyDays = lastPixValue > 0 ? Math.floor(lastPixValue / dailySpend) : 0;

    // 4. Data de esgotamento calculada
    const depletionDateObj = new Date(baseDate.getTime() + autonomyDays * 24 * 60 * 60 * 1000);
    const depletionDate = depletionDateObj.toISOString().split('T')[0];

    // 5. Dias restantes a partir de HOJE
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    depletionDateObj.setHours(12, 0, 0, 0);

    const diffTime = depletionDateObj.getTime() - today.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 6. Sugestão automática de status caso esteja em 'Saldo Saudável' ou sem status
    let suggestedStatus: RechargeStatus = currentStatus || 'Saldo Saudável';

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

  /**
   * Processa uma lista de clientes e atualiza as previsões dinamicamente
   */
  static processClients(clients: ClientData[], alertThresholdDays: number): ClientData[] {
    return clients.map(client => {
      const forecast = this.calculateForecast(
        client.lastPixDate,
        client.lastPixValue,
        client.monthlyBudget,
        client.dailySpend,
        client.status,
        alertThresholdDays
      );

      return {
        ...client,
        dailySpend: forecast.dailySpend,
        depletionDate: forecast.depletionDate,
        remainingDays: forecast.remainingDays,
        status: (client.status === 'Saldo Saudável' && forecast.suggestedStatus !== 'Saldo Saudável')
          ? forecast.suggestedStatus
          : client.status
      };
    });
  }
}
