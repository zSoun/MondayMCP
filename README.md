# MondayMCP • Sistema de Gestão de Saldo Meta Ads

Sistema moderno e isolado para monitoramento, previsão de esgotamento de saldo e notificação de recargas Pix em contas de anúncios do **Meta Ads**, desenvolvido para gestores de tráfego e equipes de performance.

Integrado diretamente com a **API v2 do Monday.com**, servidor **MCP (Model Context Protocol)** para inteligência artificial, sincronização com **Google Calendar** (feed iCal `.ics`) e disparos de alertas por **e-mail** para toda a equipe unificada.

---

## 🚀 Funcionalidades Principais

1. **Visualização Dupla:**
   - **📅 Calendário (Estilo Google Calendar):** Grade mensal com eventos de esgotamento e recarga nos dias calculados, chips coloridos por nível de urgência e clique para detalhes.
   - **📋 Kanban (Estilo Monday):** Pipeline interativo com 5 colunas arrastáveis (*Saldo Saudável*, *Alerta / Próximo de Esgotar*, *Pix Gerado*, *Pago / Aguardando Compensação*, *Saldo Confirmado*).
2. **Cálculo Automático de Autonomia (Burn Rate Híbrido):**
   - Calcula a autonomia com base no valor injetado via Pix e no ritmo de gasto diário (`Orçamento Mensal / 30` ou Gasto Diário real).
   - Aponta a data exata de esgotamento e a contagem regressiva em dias.
   - Dispara alerta automático quando faltar $\le X$ dias configuráveis (padrão: 2 dias).
3. **Provisionamento de Quadro no Monday com 1 Clique:**
   - Botão no painel de configurações que cria automaticamente o quadro e todas as 10 colunas personalizadas no seu Monday.com via API GraphQL.
4. **Notificações para a Equipe Unificada (Gestor + 2 Colaboradores):**
   - Agendador matinal automático que roda às **08:00 AM** e envia um e-mail consolidado para os 3 endereços cadastrados.
   - Botão **"Verificar & Notificar"** no painel para execução imediata sob demanda.
5. **Integração com Google Calendar:**
   - URL do feed iCal (`http://localhost:3001/api/calendar/feed.ics`) pronta para inscrição rápida no Google Agenda no PC ou celular, com lembrete nativo 1 dia antes.
6. **Servidor MCP Integrado (@modelcontextprotocol/sdk):**
   - Permite que qualquer assistente de IA (Antigravity, Claude, Cursor) liste clientes, atualize status, registre Pix e dispare sincronizações usando linguagem natural.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, TypeScript, Fastify, Fastify Static, Nodemailer, Node-Cron, Zod.
- **Frontend:** React 19, TypeScript, Vite, Lucide Icons, Date-fns, Vanilla CSS Design System.
- **MCP:** `@modelcontextprotocol/sdk` oficial com transporte Stdio.
- **APIs Externas:** Monday.com GraphQL API v2, RFC 5545 iCalendar.

---

## 📦 Como Instalar e Rodar

### 1. Pré-requisitos
- Node.js 18+ instalado.

### 2. Instalação das Dependências
```bash
# Na raiz de MondayMCP
npm install
npm install --prefix frontend
```

### 3. Configuração do `.env`
Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```
Ou simplesmente inicie o sistema e configure tudo direto pela interface visual!

### 4. Executando o Projeto
Para iniciar em modo de desenvolvimento (Backend + Frontend com hot-reload):
```bash
npm run dev
```

Para compilar e rodar a versão de produção unificada:
```bash
npm run build
npm start
```
Acesse no seu navegador: **`http://localhost:3001`** (ou `http://localhost:5173` em dev).

---

## ⚙️ Como Configurar o Monday.com (Passo a Passo)

1. Abra o painel no navegador (`http://localhost:3001`).
2. Clique no ícone de **Engrenagem (⚙️)** no canto superior direito para abrir as Configurações.
3. Na aba **Monday.com**:
   - Insira sua **API Key do Monday** (obtenha em seu Monday em: *Perfil > Desenvolvedores > API Tokens*).
   - Clique em **"Testar Conexão"** para validar.
   - Clique em **"Criar Quadro Dedicado no Monday (1 Clique)"**. O sistema criará o quadro com o nome *Controle de Saldo Meta Ads* e todas as colunas necessárias!
4. Na aba **E-mail (Equipe)**:
   - Adicione os 3 e-mails da equipe no campo *E-mails da Equipe Unificada* (ex: `gestor@empresa.com, colab1@empresa.com, colab2@empresa.com`).
   - Preencha os dados do servidor SMTP (Host, Porta, Usuário e Senha de App do Gmail/Outlook).
5. Na aba **Google Calendar**:
   - Clique em **"Copiar"** para copiar o link do Feed iCal (`.ics`).
   - No Google Agenda, clique no **+** ao lado de *Outras agendas* > *Do URL*, cole o link e confirme.

---

## 🤖 Como Usar o Servidor MCP com IA

O servidor MCP está pronto em `dist/mcp/server.js` (ou `src/mcp/server.ts` com tsx).

As ferramentas expostas são:
- `monday_list_clients`: Retorna todos os clientes, saldos e previsões.
- `monday_create_client`: Cria um novo cliente no Monday.
- `monday_update_status`: Altera o status da recarga (ex: "Pix Gerado", "Saldo Confirmado").
- `monday_record_pix_payment`: Registra um novo Pix, calcula nova data de esgotamento e confirma saldo.
- `monday_trigger_sync`: Dispara a checagem geral e envia e-mails para a equipe.

Arquivo de configuração pronto em `mcp_config.json`.
