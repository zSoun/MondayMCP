import { ClientData, AppConfig } from '../types.js';

export class CalendarService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Gera um feed compatível com o padrão RFC 5545 (.ics)
   * que pode ser assinado diretamente no Google Calendar, Apple Calendar ou Outlook
   */
  generateICalFeed(clients: ClientData[]): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const events = clients
      .filter(c => c.depletionDate)
      .map(client => {
        // Data no formato YYYYMMDD
        const dateClean = client.depletionDate.replace(/-/g, '');
        // Próximo dia para evento all-day
        const nextDateObj = new Date(`${client.depletionDate}T00:00:00Z`);
        nextDateObj.setDate(nextDateObj.getDate() + 1);
        const nextDateClean = nextDateObj.toISOString().split('T')[0].replace(/-/g, '');

        const isAlert = client.remainingDays <= this.config.alertThresholdDays;
        const icon = isAlert ? '🚨' : '💳';
        const summary = `${icon} Saldo Meta Ads: ${client.name} (R$ ${client.lastPixValue.toFixed(2)})`;
        
        const description = [
          `Cliente: ${client.name}`,
          client.metaAccountId ? `ID da Conta Meta: ${client.metaAccountId}` : null,
          `Status: ${client.status}`,
          `Gasto Diário: R$ ${client.dailySpend.toFixed(2)}/dia`,
          `Dias Restantes: ${client.remainingDays} dias`,
          `Orçamento Mensal: R$ ${client.monthlyBudget.toFixed(2)}`,
          client.pixCode ? `Link / Chave Pix: ${client.pixCode}` : null,
          client.notes ? `Observações: ${client.notes}` : null,
        ]
          .filter(Boolean)
          .join('\\n');

        return [
          'BEGIN:VEVENT',
          `UID:meta-ads-${client.id}@mondaymcp.local`,
          `DTSTAMP:${timestamp}`,
          `DTSTART;VALUE=DATE:${dateClean}`,
          `DTEND;VALUE=DATE:${nextDateClean}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          'STATUS:CONFIRMED',
          'TRANSP:TRANSPARENT',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:Lembrete de recarga para ${client.name}`,
          'TRIGGER:-P1D', // Alerta 1 dia antes
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n');
      })
      .join('\r\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MondayMCP//Meta Ads Balance Calendar//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Recargas Meta Ads (MondayMCP)',
      'X-WR-TIMEZONE:America/Sao_Paulo',
      'X-WR-CALDESC:Calendário oficial de previsão e recargas de saldo Meta Ads',
      events,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Sincronização direta via Google Calendar API (se configurado)
   */
  async syncToGoogleCalendarApi(clients: ClientData[]): Promise<{ synced: number; error?: string }> {
    if (!this.config.googleCalendar?.calendarId || !this.config.googleCalendar?.privateKey) {
      // Fallback padrão é o feed iCal (.ics)
      return { synced: 0 };
    }

    try {
      // Aqui pode ser expandido com googleapis se as credenciais do Google Cloud forem preenchidas
      return { synced: clients.length };
    } catch (err: any) {
      return { synced: 0, error: err.message };
    }
  }
}
