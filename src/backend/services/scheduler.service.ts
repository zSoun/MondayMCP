import cron, { ScheduledTask } from 'node-cron';
import { getConfig } from '../config.js';
import { MondayService } from './monday.service.js';
import { EmailService } from './email.service.js';
import { CalendarService } from './calendar.service.js';
import { SyncResult } from '../types.js';

export class SchedulerService {
  private static task: ScheduledTask | null = null;

  /**
   * Inicia o agendador de verificação diária matinal (08:00)
   */
  static start(): void {
    if (this.task) return;

    // Roda todo dia às 08:00 da manhã
    this.task = cron.schedule('0 8 * * *', async () => {
      console.log('⏰ [Scheduler] Executando checagem matinal de saldos Meta Ads...');
      try {
        await this.runCheckAndNotify();
      } catch (err) {
        console.error('❌ [Scheduler] Falha na checagem matinal:', err);
      }
    });

    console.log('⏰ [Scheduler] Agendador matinal ativado: Verificação diária às 08:00 AM.');
  }

  /**
   * Executa a checagem completa e notificações sob demanda ou pelo cron
   */
  static async runCheckAndNotify(): Promise<SyncResult> {
    const config = getConfig();
    const timestamp = new Date().toISOString();

    if (!config.mondayApiKey || !config.mondayBoardId) {
      return {
        timestamp,
        totalClients: 0,
        clientsInAlert: [],
        emailsSent: false,
        emailError: 'Monday API Key ou Board ID não configurados.',
        calendarEventsUpdated: 0,
      };
    }

    const monday = new MondayService(config.mondayApiKey);
    const email = new EmailService(config);
    const calendar = new CalendarService(config);

    // 1. Busca todos os clientes
    const clients = await monday.listClients(config.mondayBoardId, config.alertThresholdDays);

    // 2. Filtra os clientes que estão com saldo próximo de zerar
    const clientsInAlert = clients.filter(c => {
      return c.remainingDays <= config.alertThresholdDays && c.status !== 'Saldo Confirmado' && c.status !== 'Pix Gerado / Enviado ao Cliente';
    });

    // 3. Atualiza os status no Monday para 'Alerta / Próximo de Esgotar' se ainda estiver 'Saldo Saudável'
    for (const client of clientsInAlert) {
      if (client.status === 'Saldo Saudável') {
        try {
          await monday.updateStatus(config.mondayBoardId, client.id, 'Alerta / Próximo de Esgotar');
        } catch (e) {
          console.warn(`Não foi possível atualizar status do cliente ${client.name} no Monday:`, e);
        }
      }
    }

    // 4. Dispara e-mail de alerta para a equipe
    let emailsSent = false;
    let emailError: string | undefined;

    if (clientsInAlert.length > 0) {
      const emailRes = await email.sendBalanceAlerts(clientsInAlert);
      emailsSent = emailRes.success;
      emailError = emailRes.error;
    }

    // 5. Sincroniza calendário se aplicável
    const calRes = await calendar.syncToGoogleCalendarApi(clients);

    return {
      timestamp,
      totalClients: clients.length,
      clientsInAlert,
      emailsSent,
      emailError,
      calendarEventsUpdated: calRes.synced,
    };
  }
}
