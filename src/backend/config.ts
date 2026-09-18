import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AppConfig } from './types.js';

// Carrega o .env se existir
dotenv.config();

const envPath = path.resolve(process.cwd(), '.env');

export function getConfig(): AppConfig {
  const teamEmailsRaw = process.env.TEAM_EMAILS || '';
  const teamEmails = teamEmailsRaw
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    mondayApiKey: process.env.MONDAY_API_KEY || '',
    mondayBoardId: process.env.MONDAY_BOARD_ID || '',
    alertThresholdDays: parseInt(process.env.ALERT_THRESHOLD_DAYS || '2', 10),
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'Alerta de Saldo Meta Ads <noreply@trafficflow.io>',
    },
    teamEmails,
    googleCalendar: {
      calendarId: process.env.GOOGLE_CALENDAR_ID || '',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
    }
  };
}

export function saveConfig(updates: Partial<AppConfig>): void {
  // Lê o .env atual ou cria se não existir
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const map: Record<string, string> = {};
  if (updates.mondayApiKey !== undefined) map['MONDAY_API_KEY'] = updates.mondayApiKey;
  if (updates.mondayBoardId !== undefined) map['MONDAY_BOARD_ID'] = updates.mondayBoardId;
  if (updates.alertThresholdDays !== undefined) map['ALERT_THRESHOLD_DAYS'] = updates.alertThresholdDays.toString();
  if (updates.teamEmails !== undefined) map['TEAM_EMAILS'] = updates.teamEmails.join(',');
  
  if (updates.smtp) {
    if (updates.smtp.host !== undefined) map['SMTP_HOST'] = updates.smtp.host;
    if (updates.smtp.port !== undefined) map['SMTP_PORT'] = updates.smtp.port.toString();
    if (updates.smtp.secure !== undefined) map['SMTP_SECURE'] = updates.smtp.secure ? 'true' : 'false';
    if (updates.smtp.user !== undefined) map['SMTP_USER'] = updates.smtp.user;
    if (updates.smtp.pass !== undefined) map['SMTP_PASS'] = updates.smtp.pass;
    if (updates.smtp.from !== undefined) map['SMTP_FROM'] = updates.smtp.from;
  }

  if (updates.googleCalendar) {
    if (updates.googleCalendar.calendarId !== undefined) map['GOOGLE_CALENDAR_ID'] = updates.googleCalendar.calendarId;
    if (updates.googleCalendar.serviceAccountEmail !== undefined) map['GOOGLE_SERVICE_ACCOUNT_EMAIL'] = updates.googleCalendar.serviceAccountEmail;
    if (updates.googleCalendar.privateKey !== undefined) map['GOOGLE_PRIVATE_KEY'] = updates.googleCalendar.privateKey;
  }

  // Atualiza process.env e monta o arquivo
  for (const [k, v] of Object.entries(map)) {
    process.env[k] = v;
    const regex = new RegExp(`^${k}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${k}=${v}`);
    } else {
      content += `\n${k}=${v}`;
    }
  }

  fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
}
