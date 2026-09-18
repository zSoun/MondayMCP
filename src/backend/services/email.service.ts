import nodemailer, { Transporter } from 'nodemailer';
import { AppConfig, ClientData } from '../types.js';

export class EmailService {
  private config: AppConfig;
  private transporter: Transporter | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    this.initTransporter();
  }

  private initTransporter() {
    if (this.config.smtp.user && this.config.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.pass,
        },
      });
    }
  }

  /**
   * Testa a conexão SMTP
   */
  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return { success: false, message: 'Configurações de SMTP incompletas (usuário ou senha ausentes).' };
    }
    try {
      await this.transporter.verify();
      return { success: true, message: 'Conexão SMTP validada com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao conectar no servidor SMTP.' };
    }
  }

  /**
   * Dispara o e-mail de alerta para a equipe unificada
   */
  async sendBalanceAlerts(clientsInAlert: ClientData[]): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Servidor de e-mail SMTP não configurado.' };
    }

    if (!this.config.teamEmails || this.config.teamEmails.length === 0) {
      return { success: false, error: 'Nenhum e-mail de equipe cadastrado (TEAM_EMAILS).' };
    }

    if (clientsInAlert.length === 0) {
      return { success: true }; // Nada em alerta, não precisa incomodar a equipe
    }

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const count = clientsInAlert.length;
    const subject = `🚨 [Alerta de Saldo] ${count} ${count === 1 ? 'conta precisa' : 'contas precisam'} de recarga no Meta Ads - ${todayStr}`;

    const itemsHtml = clientsInAlert
      .map(client => {
        const isCritical = client.remainingDays <= 1;
        const badgeColor = isCritical ? '#ef4444' : '#f59e0b';
        const badgeText = client.remainingDays <= 0 ? 'ZERADO OU EXPIRANDO HOJE' : `${client.remainingDays} dia(s) restante(s)`;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 14px 16px; font-weight: 600; color: #0f172a; font-size: 15px;">
              ${client.name}
              ${client.metaAccountId ? `<div style="font-size: 12px; color: #64748b; font-weight: normal; margin-top: 2px;">ID Meta: ${client.metaAccountId}</div>` : ''}
            </td>
            <td style="padding: 14px 16px;">
              <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700;">
                ${badgeText}
              </span>
            </td>
            <td style="padding: 14px 16px; color: #334155; font-size: 14px;">
              R$ ${client.dailySpend.toFixed(2)}/dia
            </td>
            <td style="padding: 14px 16px; color: #0f172a; font-weight: 600; font-size: 14px;">
              ${client.depletionDate ? client.depletionDate.split('-').reverse().join('/') : 'A calcular'}
            </td>
            <td style="padding: 14px 16px; color: #334155; font-size: 14px;">
              R$ ${client.lastPixValue.toFixed(2)}
            </td>
            <td style="padding: 14px 16px; font-size: 13px;">
              ${client.pixCode ? `<a href="${client.pixCode}" style="color: #2563eb; text-decoration: underline; font-weight: 600;" target="_blank">Abrir Pix / Fatura</a>` : '<span style="color: #94a3b8;">Não informado</span>'}
            </td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 28px 32px; }
          .title { font-size: 22px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.02em; }
          .subtitle { font-size: 14px; color: #94a3b8; margin: 0; }
          .content { padding: 28px 32px; }
          .banner { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; color: #991b1b; font-size: 14px; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { background-color: #f1f5f9; padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
          .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 13px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">⚡ Gestão de Tráfego - Alerta de Saldo Meta Ads</h1>
            <p class="subtitle">Resumo diário consolidado para a equipe • ${todayStr}</p>
          </div>
          <div class="content">
            <div class="banner">
              ⚠️ <strong>Atenção Equipe:</strong> ${count} cliente(s) atingiram o limite de segurança de saldo e precisam de emissão/cobrança de Pix antes que as campanhas pausem.
            </div>

            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Urgência</th>
                  <th>Gasto Diário</th>
                  <th>Previsão Zera</th>
                  <th>Último Pix</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          <div class="footer">
            Enviado automaticamente pelo <strong>MondayMCP</strong> para a equipe unificada (${this.config.teamEmails.join(', ')}).
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.smtp.from,
        to: this.config.teamEmails,
        subject,
        html,
      });
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao enviar e-mail de alerta:', err);
      return { success: false, error: err.message };
    }
  }
}
