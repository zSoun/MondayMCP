import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ClientData } from '../services/api';

interface CalendarViewProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
  onRecordPix: (client: ClientData) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  clients,
  onSelectClient,
  onRecordPix,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Nomes dos meses e dias em PT-BR
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Primeiro dia do mês e total de dias
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const todayStr = new Date().toISOString().split('T')[0];

  // Agrupa clientes por data de esgotamento (YYYY-MM-DD)
  const eventsByDate: Record<string, ClientData[]> = {};
  for (const client of clients) {
    if (client.depletionDate) {
      if (!eventsByDate[client.depletionDate]) {
        eventsByDate[client.depletionDate] = [];
      }
      eventsByDate[client.depletionDate].push(client);
    }
  }

  // Monta as células do calendário
  const daysCells = [];

  // Dias do mês anterior
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    daysCells.push({
      dayNumber: d,
      isCurrentMonth: false,
      dateStr: '',
    });
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    daysCells.push({
      dayNumber: d,
      isCurrentMonth: true,
      dateStr,
      isToday: dateStr === todayStr,
      events: eventsByDate[dateStr] || [],
    });
  }

  // Completa a grade para fechar semanas completas (múltiplos de 7)
  const remainingCells = (7 - (daysCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    daysCells.push({
      dayNumber: d,
      isCurrentMonth: false,
      dateStr: '',
    });
  }

  const getChipStyle = (client: ClientData) => {
    if (client.remainingDays <= 1) {
      return { background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)' };
    }
    if (client.remainingDays <= 3) {
      return { background: 'rgba(245, 158, 11, 0.25)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.5)' };
    }
    if (client.status === 'Pix Gerado / Enviado ao Cliente') {
      return { background: 'rgba(139, 92, 246, 0.25)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.5)' };
    }
    return { background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.4)' };
  };

  return (
    <div className="calendar-view-container">
      <div className="calendar-header">
        <div>
          <h2 className="calendar-title">
            {monthNames[month]} de {year}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Exibindo previsão de esgotamento e recargas agendadas
          </span>
        </div>

        <div className="calendar-nav-buttons">
          <button className="btn btn-secondary" onClick={handleToday} style={{ padding: '6px 14px' }}>
            Hoje
          </button>
          <button className="btn-icon" onClick={handlePrevMonth} title="Mês Anterior">
            <ChevronLeft size={18} />
          </button>
          <button className="btn-icon" onClick={handleNextMonth} title="Próximo Mês">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}

        {daysCells.map((cell, idx) => (
          <div
            key={idx}
            className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''}`}
          >
            <div className="day-header">
              <span className="day-number">{cell.dayNumber}</span>
              {cell.events && cell.events.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {cell.events.length} {cell.events.length === 1 ? 'recarga' : 'recargas'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '100px' }}>
              {cell.events &&
                cell.events.map(client => {
                  const style = getChipStyle(client);
                  return (
                    <div
                      key={client.id}
                      className="event-chip"
                      style={style}
                      onClick={() => onSelectClient(client)}
                      title={`${client.name}\nGasto: R$ ${client.dailySpend.toFixed(2)}/dia\nRestam: ${client.remainingDays} dias\nStatus: ${client.status}`}
                    >
                      {client.remainingDays <= 2 ? (
                        <AlertTriangle size={12} />
                      ) : client.status === 'Pix Gerado / Enviado ao Cliente' ? (
                        <Clock size={12} />
                      ) : (
                        <CheckCircle size={12} />
                      )}
                      <span>
                        {client.name} • R$ {client.lastPixValue.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
