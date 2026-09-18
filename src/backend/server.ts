import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { getConfig, saveConfig } from './config.js';
import { MondayService } from './services/monday.service.js';
import { EmailService } from './services/email.service.js';
import { CalendarService } from './services/calendar.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { RechargeStatus } from './types.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
});

// Serve frontend build if exists
const frontendDist = path.resolve(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  fastify.register(fastifyStatic, {
    root: frontendDist,
    prefix: '/',
  });
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
fastify.get('/api/health', async () => {
  return { status: 'online', time: new Date().toISOString() };
});

// -------------------------------------------------------------
// Settings & Configuration
// -------------------------------------------------------------
fastify.get('/api/settings', async () => {
  const config = getConfig();
  let mondayConnected = false;
  let mondayUser: any = null;

  if (config.mondayApiKey) {
    const monday = new MondayService(config.mondayApiKey);
    const test = await monday.testConnection();
    mondayConnected = test.valid;
    mondayUser = test.user;
  }

  return {
    mondayConnected,
    mondayUser,
    mondayApiKeyConfigured: !!config.mondayApiKey,
    mondayBoardId: config.mondayBoardId,
    alertThresholdDays: config.alertThresholdDays,
    teamEmails: config.teamEmails,
    smtp: {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      user: config.smtp.user,
      configured: !!(config.smtp.user && config.smtp.pass),
      from: config.smtp.from,
    },
    googleCalendarConfigured: !!(config.googleCalendar?.calendarId && config.googleCalendar?.privateKey),
    icalFeedUrl: `http://localhost:${config.port}/api/calendar/feed.ics`,
  };
});

fastify.post<{ Body: any }>('/api/settings', async (request, reply) => {
  const body = request.body;
  saveConfig(body as any);
  return { success: true, message: 'Configurações salvas com sucesso!' };
});

// -------------------------------------------------------------
// Monday.com Provisioning & Test
// -------------------------------------------------------------
fastify.post<{ Body: { apiKey?: string } }>('/api/monday/test', async (request, reply) => {
  const config = getConfig();
  const apiKey = request.body?.apiKey || config.mondayApiKey;
  if (!apiKey) {
    return reply.status(400).send({ valid: false, error: 'Chave de API não informada.' });
  }

  const monday = new MondayService(apiKey);
  const result = await monday.testConnection();
  return result;
});

fastify.post<{ Body: { boardName?: string; apiKey?: string } }>('/api/monday/provision', async (request, reply) => {
  const config = getConfig();
  const apiKey = request.body?.apiKey || config.mondayApiKey;
  if (!apiKey) {
    return reply.status(400).send({ error: 'Chave de API do Monday não informada.' });
  }

  try {
    const monday = new MondayService(apiKey);
    const result = await monday.provisionBoard(request.body?.boardName || 'Controle de Saldo Meta Ads');
    
    // Salva o novo boardId no .env
    saveConfig({ mondayBoardId: result.boardId, ...(request.body?.apiKey ? { mondayApiKey: request.body.apiKey } : {}) });

    return {
      success: true,
      message: 'Quadro criado com sucesso no Monday com todas as 10 colunas configuradas!',
      boardId: result.boardId,
      columns: result.columns,
    };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro ao criar quadro no Monday.com' });
  }
});

// -------------------------------------------------------------
// Clients CRUD & Balance
// -------------------------------------------------------------
fastify.get('/api/clients', async (request, reply) => {
  const config = getConfig();
  if (!config.mondayApiKey || !config.mondayBoardId) {
    return reply.status(400).send({
      error: 'Monday API Key ou Board ID não configurados. Acesse as Configurações para conectar sua conta.',
      needsConfig: true,
    });
  }

  try {
    const monday = new MondayService(config.mondayApiKey);
    const clients = await monday.listClients(config.mondayBoardId, config.alertThresholdDays);
    return { clients };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro ao carregar clientes do Monday' });
  }
});

fastify.post<{ Body: any }>('/api/clients', async (request, reply) => {
  const config = getConfig();
  if (!config.mondayApiKey || !config.mondayBoardId) {
    return reply.status(400).send({ error: 'Monday não configurado.' });
  }

  try {
    const monday = new MondayService(config.mondayApiKey);
    const res = await monday.createClient(config.mondayBoardId, request.body as any);
    return { success: true, id: res.id };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro ao criar cliente no Monday' });
  }
});

fastify.patch<{ Params: { id: string }; Body: any }>('/api/clients/:id', async (request, reply) => {
  const config = getConfig();
  if (!config.mondayApiKey || !config.mondayBoardId) {
    return reply.status(400).send({ error: 'Monday não configurado.' });
  }

  try {
    const monday = new MondayService(config.mondayApiKey);
    await monday.updateClient(config.mondayBoardId, request.params.id, request.body as any);
    return { success: true };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro ao atualizar cliente' });
  }
});

fastify.patch<{ Params: { id: string }; Body: { status: RechargeStatus } }>('/api/clients/:id/status', async (request, reply) => {
  const config = getConfig();
  if (!config.mondayApiKey || !config.mondayBoardId) {
    return reply.status(400).send({ error: 'Monday não configurado.' });
  }

  try {
    const monday = new MondayService(config.mondayApiKey);
    await monday.updateStatus(config.mondayBoardId, request.params.id, request.body.status);
    return { success: true };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro ao alterar status' });
  }
});

fastify.post<{ Params: { id: string }; Body: { pixValue: number; pixDate?: string; monthlyBudget?: number; dailySpend?: number } }>(
  '/api/clients/:id/record-pix',
  async (request, reply) => {
    const config = getConfig();
    if (!config.mondayApiKey || !config.mondayBoardId) {
      return reply.status(400).send({ error: 'Monday não configurado.' });
    }

    try {
      const monday = new MondayService(config.mondayApiKey);
      const pixDate = request.body.pixDate || new Date().toISOString().split('T')[0];
      await monday.recordPixPayment(
        config.mondayBoardId,
        request.params.id,
        request.body.pixValue,
        pixDate,
        request.body.monthlyBudget || 0,
        request.body.dailySpend
      );
      return { success: true, message: 'Pix registrado e previsão recalculada com sucesso!' };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message || 'Erro ao registrar Pix' });
    }
  }
);

// -------------------------------------------------------------
// On-Demand Sync & Notifications
// -------------------------------------------------------------
fastify.post('/api/sync', async (request, reply) => {
  try {
    const result = await SchedulerService.runCheckAndNotify();
    return { success: true, result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erro durante a sincronização de saldos' });
  }
});

// -------------------------------------------------------------
// Calendar iCal (.ics) Feed
// -------------------------------------------------------------
fastify.get('/api/calendar/feed.ics', async (request, reply) => {
  const config = getConfig();
  if (!config.mondayApiKey || !config.mondayBoardId) {
    return reply.status(400).send('Monday.com não configurado.');
  }

  try {
    const monday = new MondayService(config.mondayApiKey);
    const clients = await monday.listClients(config.mondayBoardId, config.alertThresholdDays);
    const calendar = new CalendarService(config);
    const icsContent = calendar.generateICalFeed(clients);

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="recargas-meta-ads.ics"')
      .send(icsContent);
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send('Erro ao gerar feed do calendário.');
  }
});

// Inicia servidor e agendador
const config = getConfig();
SchedulerService.start();

try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`🚀 [Server] Backend rodando em http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
