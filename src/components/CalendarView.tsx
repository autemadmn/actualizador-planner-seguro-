import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import type { ComparedRow } from '../types/comparison';
import { formatDateForSpain } from '../utils/dateUtils';
import { getDueDate, inferRowHierarchy, isStructuralRow } from '../utils/plannerData';
import { EmptyState } from './EmptyState';
import { EventDetailModal } from './EventDetailModal';

interface CalendarViewProps {
  rows: ComparedRow[];
}

function eventColorForRow(row: ComparedRow): { backgroundColor: string; borderColor: string; textColor: string } {
  if (row.changedFields.length > 0) {
    return { backgroundColor: '#D97706', borderColor: '#B45309', textColor: '#FFFFFF' };
  }

  if (row.status === 'unmatched') {
    return { backgroundColor: '#EEF3F8', borderColor: '#9CADBF', textColor: '#10263F' };
  }

  return { backgroundColor: '#244A70', borderColor: '#173452', textColor: '#FFFFFF' };
}

export function CalendarView({ rows }: CalendarViewProps) {
  const [selectedRow, setSelectedRow] = useState<ComparedRow | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [selectedDueDate, setSelectedDueDate] = useState<string | null | undefined>();
  const rowContexts = useMemo(() => inferRowHierarchy(rows), [rows]);

  const events = useMemo<EventInput[]>(() => {
    return rows.flatMap((row, index) => {
      const dueDate = getDueDate(row);
      if (!dueDate || isStructuralRow(row)) {
        return [];
      }

      const colors = eventColorForRow(row);
      const context = rowContexts.get(row);
      const taskName = row.currentRow.taskName.trim() || 'Sin nombre';
      const assignee = row.currentRow.assignee.trim() || 'Sin asignar';

      return [
        {
          id: String(index),
          title: taskName,
          allDay: true,
          start: dueDate,
          extendedProps: { row, assignee, project: context?.project, dueDate },
          ...colors,
        },
      ];
    });
  }, [rowContexts, rows]);
  const initialDate = useMemo(() => {
    return events
      .map((event) => (typeof event.start === 'string' ? event.start : null))
      .filter((date): date is string => Boolean(date))
      .sort()[0];
  }, [events]);

  if (events.length === 0) {
    return (
      <EmptyState
        title="No hay tareas con fechas válidas"
        description="Las filas filtradas no tienen fecha de inicio ni de finalización para mostrar en calendario."
      />
    );
  }

  const handleEventClick = (eventClick: EventClickArg): void => {
    const row = eventClick.event.extendedProps.row as ComparedRow | undefined;
    if (row) {
      const project =
        typeof eventClick.event.extendedProps.project === 'string'
          ? eventClick.event.extendedProps.project
          : undefined;
      const dueDate =
        typeof eventClick.event.extendedProps.dueDate === 'string'
          ? eventClick.event.extendedProps.dueDate
          : null;

      setSelectedProject(project);
      setSelectedDueDate(dueDate);
      setSelectedRow(row);
    }
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const assignee =
      typeof eventInfo.event.extendedProps.assignee === 'string'
        ? eventInfo.event.extendedProps.assignee
        : 'Sin asignar';

    return (
      <div className="calendar-event-content">
        <span className="calendar-event-title">{eventInfo.event.title}</span>
        <span className="calendar-event-assignee">Asignado a: {assignee}</span>
      </div>
    );
  };

  return (
    <section className="calendar-panel">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={initialDate}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
        }}
        locale="es"
        firstDay={1}
        height="auto"
        fixedWeekCount={false}
        dayMaxEvents={3}
        moreLinkText={(count) => `+${count} más`}
        events={events}
        eventContent={renderEventContent}
        eventClick={handleEventClick}
        eventDidMount={(info) => {
          const dueDate =
            typeof info.event.extendedProps.dueDate === 'string'
              ? formatDateForSpain(info.event.extendedProps.dueDate)
              : '';
          info.el.setAttribute('title', `${info.event.title}${dueDate ? ` - Vence ${dueDate}` : ''}`);
        }}
      />
      {selectedRow && (
        <EventDetailModal
          row={selectedRow}
          project={selectedProject}
          dueDate={selectedDueDate}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </section>
  );
}
