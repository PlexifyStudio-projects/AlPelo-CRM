import { daysSince, formatCurrency, formatDate } from '../../../utils/formatters';
import { STATUS_META } from '../../../utils/clientStatus';

const ClientTable = ({ clients, onClientClick, sortConfig, onSort }) => {
  const b = 'client-table';

  const getStatusLabel = (status) => STATUS_META[status]?.label || status;

  const getInitials = (name) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const getDaysClass = (lastVisit) => {
    if (!lastVisit) return '';
    const days = daysSince(lastVisit);
    if (days > 60) return `${b}__days--danger`;
    if (days > 45) return `${b}__days--warning`;
    if (days >= 30) return `${b}__days--caution`;
    return `${b}__days--ok`;
  };

  const SortIcon = ({ column }) => {
    if (sortConfig?.key !== column) {
      return (
        <svg className={`${b}__sort-icon`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M7 15l5 5 5-5" />
          <path d="M7 9l5-5 5 5" />
        </svg>
      );
    }
    return (
      <svg className={`${b}__sort-icon ${b}__sort-icon--active`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {sortConfig.direction === 'asc'
          ? <path d="M7 14l5-5 5 5" />
          : <path d="M7 10l5 5 5-5" />
        }
      </svg>
    );
  };

  return (
    <div className={b}>
      {/* Desktop: Table view */}
      <div className={`${b}__wrapper`}>
        <table className={`${b}__table`}>
          <thead className={`${b}__head`}>
            <tr>
              <th className={`${b}__th ${b}__th--id`}>
                <span className={`${b}__th-content`}>ID</span>
              </th>
              <th className={`${b}__th`} onClick={() => onSort('name')}>
                <span className={`${b}__th-content`}>
                  Cliente <SortIcon column="name" />
                </span>
              </th>
              <th className={`${b}__th`} onClick={() => onSort('last_visit')}>
                <span className={`${b}__th-content`}>
                  Última visita <SortIcon column="last_visit" />
                </span>
              </th>
              <th className={`${b}__th ${b}__th--right ${b}__th--hide-sm`} onClick={() => onSort('total_visits')}>
                <span className={`${b}__th-content`}>
                  Visitas <SortIcon column="total_visits" />
                </span>
              </th>
              <th className={`${b}__th ${b}__th--right ${b}__th--hide-sm`} onClick={() => onSort('total_spent')}>
                <span className={`${b}__th-content`}>
                  Total gastado <SortIcon column="total_spent" />
                </span>
              </th>
              <th className={`${b}__th`} onClick={() => onSort('status')}>
                <span className={`${b}__th-content`}>
                  Estado <SortIcon column="status" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className={`${b}__body`}>
            {clients.map((client, index) => (
              <tr
                key={client.id}
                className={`${b}__row`}
                onClick={() => onClientClick(client)}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <td className={`${b}__td ${b}__td--id`}>
                  <span className={`${b}__client-id`}>{client.client_id}</span>
                </td>
                <td className={`${b}__td`}>
                  <div className={`${b}__client-cell`}>
                    <div className={`${b}__avatar ${b}__avatar--${client.status}`}>
                      {getInitials(client.name)}
                    </div>
                    <div className={`${b}__client-info`}>
                      <span className={`${b}__client-name`}>{client.name}</span>
                      <span className={`${b}__client-phone`}>{client.phone}</span>
                    </div>
                  </div>
                </td>
                <td className={`${b}__td`}>
                  {client.last_visit ? (
                    <div className={`${b}__visit-cell`}>
                      <span className={`${b}__date`}>{formatDate(client.last_visit)}</span>
                      <span className={`${b}__days ${getDaysClass(client.last_visit)}`}>
                        hace {daysSince(client.last_visit)}d
                      </span>
                    </div>
                  ) : (
                    <span className={`${b}__no-visit`}>Sin visitas</span>
                  )}
                </td>
                <td className={`${b}__td ${b}__td--right ${b}__td--hide-sm`}>
                  <span className={`${b}__visits-count`}>{client.total_visits}</span>
                </td>
                <td className={`${b}__td ${b}__td--right ${b}__td--hide-sm`}>
                  <span className={`${b}__spent`}>{formatCurrency(client.total_spent)}</span>
                  {client.avg_ticket > 0 && (
                    <span className={`${b}__avg-ticket`}>prom. {formatCurrency(client.avg_ticket)}</span>
                  )}
                </td>
                <td className={`${b}__td`}>
                  <span className={`${b}__status ${b}__status--${client.status}`}>
                    {client.status === 'vip' && (
                      <svg className={`${b}__status-icon`} width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                      </svg>
                    )}
                    {client.status === 'en_riesgo' && (
                      <svg className={`${b}__status-icon`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                    )}
                    {getStatusLabel(client.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className={`${b}__cards`}>
        {clients.map((client, index) => (
          <div
            key={client.id}
            className={`${b}__card`}
            onClick={() => onClientClick(client)}
            style={{ animationDelay: `${index * 0.04}s` }}
          >
            <div className={`${b}__card-top`}>
              <div className={`${b}__avatar ${b}__avatar--${client.status}`}>
                {getInitials(client.name)}
              </div>
              <div className={`${b}__card-info`}>
                <span className={`${b}__client-name`}>{client.name}</span>
                <span className={`${b}__client-phone`}>{client.client_id} &middot; {client.phone}</span>
              </div>
              <span className={`${b}__status ${b}__status--${client.status}`}>
                {client.status === 'vip' && (
                  <svg className={`${b}__status-icon`} width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                  </svg>
                )}
                {getStatusLabel(client.status)}
              </span>
            </div>
            <div className={`${b}__card-stats`}>
              <div className={`${b}__card-stat`}>
                <span className={`${b}__card-stat-label`}>Ultima visita</span>
                {client.last_visit ? (
                  <span className={`${b}__days ${getDaysClass(client.last_visit)}`}>
                    hace {daysSince(client.last_visit)}d
                  </span>
                ) : (
                  <span className={`${b}__no-visit`}>--</span>
                )}
              </div>
              <div className={`${b}__card-stat`}>
                <span className={`${b}__card-stat-label`}>Visitas</span>
                <span className={`${b}__visits-count`}>{client.total_visits}</span>
              </div>
              <div className={`${b}__card-stat`}>
                <span className={`${b}__card-stat-label`}>Total</span>
                <span className={`${b}__spent`}>{formatCurrency(client.total_spent)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientTable;
