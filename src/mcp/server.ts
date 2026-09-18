import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from '../backend/config.js';
import { MondayService } from '../backend/services/monday.service.js';
import { SchedulerService } from '../backend/services/scheduler.service.js';

const server = new Server(
  {
    name: 'monday-mcp-meta-ads',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// -------------------------------------------------------------
// Lista de Ferramentas MCP
// -------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'monday_list_clients',
        description: 'Lista todos os clientes gerenciados no Monday.com com seus respectivos saldos, previsões de esgotamento e status da recarga.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'monday_create_client',
        description: 'Cadastra um novo cliente/conta de anúncios no quadro do Monday.com.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome da empresa ou cliente' },
            metaAccountId: { type: 'string', description: 'ID da conta no Gerenciador de Anúncios do Meta' },
            monthlyBudget: { type: 'number', description: 'Orçamento total mensal em R$' },
            dailySpend: { type: 'number', description: 'Gasto diário médio estimado em R$/dia' },
            lastPixValue: { type: 'number', description: 'Valor do último Pix inserido em R$' },
            lastPixDate: { type: 'string', description: 'Data do último Pix (YYYY-MM-DD)' },
            pixCode: { type: 'string', description: 'Código Pix Copia-e-Cola ou Link da fatura' },
            notes: { type: 'string', description: 'Observações sobre a conta ou estratégia' },
          },
          required: ['name', 'monthlyBudget'],
        },
      },
      {
        name: 'monday_update_status',
        description: 'Atualiza a etapa do pipeline/status de recarga de um cliente.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: { type: 'string', description: 'ID do item no Monday' },
            status: {
              type: 'string',
              enum: [
                'Saldo Saudável',
                'Alerta / Próximo de Esgotar',
                'Pix Gerado / Enviado ao Cliente',
                'Pago / Aguardando Compensação',
                'Saldo Confirmado',
              ],
              description: 'Novo status da recarga',
            },
          },
          required: ['clientId', 'status'],
        },
      },
      {
        name: 'monday_record_pix_payment',
        description: 'Registra o pagamento/injeção de um novo Pix para o cliente, recalculando a nova previsão de esgotamento e marcando como Saldo Confirmado.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: { type: 'string', description: 'ID do item no Monday' },
            pixValue: { type: 'number', description: 'Valor do Pix inserido em R$' },
            pixDate: { type: 'string', description: 'Data do pagamento (YYYY-MM-DD). Se omitido, usa a data atual.' },
            monthlyBudget: { type: 'number', description: 'Orçamento mensal do cliente (opcional para recálculo)' },
            dailySpend: { type: 'number', description: 'Gasto diário médio (opcional)' },
          },
          required: ['clientId', 'pixValue'],
        },
      },
      {
        name: 'monday_trigger_sync',
        description: 'Dispara a verificação imediata dos saldos de todos os clientes, atualiza status de alerta no Monday e envia notificações por e-mail para a equipe.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// -------------------------------------------------------------
// Execução das Ferramentas MCP
// -------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const config = getConfig();

  if (!config.mondayApiKey || !config.mondayBoardId) {
    return {
      content: [
        {
          type: 'text',
          text: 'Erro: Chave de API do Monday (MONDAY_API_KEY) ou Board ID (MONDAY_BOARD_ID) não configurados no arquivo .env.',
        },
      ],
      isError: true,
    };
  }

  const monday = new MondayService(config.mondayApiKey);

  try {
    switch (name) {
      case 'monday_list_clients': {
        const clients = await monday.listClients(config.mondayBoardId, config.alertThresholdDays);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(clients, null, 2),
            },
          ],
        };
      }

      case 'monday_create_client': {
        const res = await monday.createClient(config.mondayBoardId, args as any);
        return {
          content: [
            {
              type: 'text',
              text: `Cliente "${args?.name}" criado com sucesso no Monday (Item ID: ${res.id}).`,
            },
          ],
        };
      }

      case 'monday_update_status': {
        await monday.updateStatus(config.mondayBoardId, (args as any).clientId, (args as any).status);
        return {
          content: [
            {
              type: 'text',
              text: `Status do cliente ID ${(args as any).clientId} atualizado para "${(args as any).status}".`,
            },
          ],
        };
      }

      case 'monday_record_pix_payment': {
        const pixDate = (args as any).pixDate || new Date().toISOString().split('T')[0];
        await monday.recordPixPayment(
          config.mondayBoardId,
          (args as any).clientId,
          (args as any).pixValue,
          pixDate,
          (args as any).monthlyBudget || 0,
          (args as any).dailySpend
        );
        return {
          content: [
            {
              type: 'text',
              text: `Pix de R$ ${(args as any).pixValue} registrado com sucesso em ${pixDate}. Previsão recalculada!`,
            },
          ],
        };
      }

      case 'monday_trigger_sync': {
        const syncRes = await SchedulerService.runCheckAndNotify();
        return {
          content: [
            {
              type: 'text',
              text: `Sincronização concluída:\n- Total de Clientes: ${syncRes.totalClients}\n- Em Alerta (<= ${config.alertThresholdDays} dias): ${syncRes.clientsInAlert.length}\n- E-mails disparados: ${syncRes.emailsSent ? 'Sim' : 'Não'}${syncRes.emailError ? ` (Erro: ${syncRes.emailError})` : ''}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }],
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Erro ao executar ferramenta ${name}: ${err.message}` }],
      isError: true,
    };
  }
});

// Inicialização via STDIO
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Servidor MCP MondayMetaAds iniciado via Stdio.');
}

run().catch((err) => {
  console.error('Erro ao iniciar servidor MCP:', err);
  process.exit(1);
});
