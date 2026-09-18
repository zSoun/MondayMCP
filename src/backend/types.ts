export type RechargeStatus = 
  | 'Saldo Saudável'
  | 'Alerta / Próximo de Esgotar'
  | 'Pix Gerado / Enviado ao Cliente'
  | 'Pago / Aguardando Compensação'
  | 'Saldo Confirmado';

export interface ClientData {
  id: string; // Monday Item ID
  name: string; // Nome do Cliente / Empresa
  metaAccountId: string; // ID da Conta no Meta Ads
  monthlyBudget: number; // Orçamento Total do Mês (R$)
  dailySpend: number; // Gasto Diário Médio (R$/dia)
  lastPixDate: string; // Data do Último Pix (YYYY-MM-DD)
  lastPixValue: number; // Valor do Último Pix (R$)
  depletionDate: string; // Previsão de Esgotamento (YYYY-MM-DD)
  remainingDays: number; // Dias restantes até zerar
  status: RechargeStatus; // Etapa do Pipeline
  pixCode: string; // Link da fatura ou Copia-e-Cola
  notes: string; // Observações / Estratégia
  updatedAt?: string;
}

export interface BoardColumnMapping {
  metaAccountId?: string;
  monthlyBudget?: string;
  dailySpend?: string;
  lastPixDate?: string;
  lastPixValue?: string;
  depletionDate?: string;
  remainingDays?: string;
  status?: string;
  pixCode?: string;
  notes?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  mondayApiKey: string;
  mondayBoardId: string;
  alertThresholdDays: number;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  teamEmails: string[];
  googleCalendar?: {
    calendarId?: string;
    serviceAccountEmail?: string;
    privateKey?: string;
  };
}

export interface SyncResult {
  timestamp: string;
  totalClients: number;
  clientsInAlert: ClientData[];
  emailsSent: boolean;
  emailError?: string;
  calendarEventsUpdated: number;
}
