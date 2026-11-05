import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useTimesheet } from '../context/TimesheetContext';
import { calculateDuration, isIssueKey } from '../utils/ticketValidation';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`stats-tabpanel-${index}`}
      aria-labelledby={`stats-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const StatsModal: React.FC<StatsModalProps> = ({ open, onClose }) => {
  const { entries } = useTimesheet();
  const { jiraApi } = useAuth();
  const { locale } = useLocale();
  const [tabValue, setTabValue] = useState(0);

  // Extract unique existing ticket keys for fetching titles
  const ticketKeys = useMemo(() => {
    const keys = new Set<string>();
    entries.forEach(entry => {
      if (isIssueKey(entry.issue)) {
        keys.add(entry.issue.trim().toUpperCase());
      }
    });
    return Array.from(keys);
  }, [entries]);

  // Fetch issue details (uses JiraApiService cache, so already-validated tickets are instant)
  const { data: issueDetails } = useQuery({
    queryKey: ['issueDetails', ticketKeys.sort().join(',')],
    queryFn: async () => {
      if (!jiraApi || ticketKeys.length === 0) return {};
      return await jiraApi.getMultipleIssues(ticketKeys);
    },
    enabled: open && !!jiraApi && ticketKeys.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Calculate hours by day
  const hoursByDay = useMemo(() => {
    const hoursMap = new Map<string, number>();

    entries.forEach(entry => {
      if (entry.startTime && entry.endTime) {
        const seconds = calculateDuration(entry.startTime, entry.endTime);
        const hours = seconds / 3600;
        const currentHours = hoursMap.get(entry.date) || 0;
        hoursMap.set(entry.date, currentHours + hours);
      }
    });

    return hoursMap;
  }, [entries]);

  // Calculate hours by ticket
  const hoursByTicket = useMemo(() => {
    const hoursMap = new Map<string, number>();
    const descriptionMap = new Map<string, string>();

    entries.forEach(entry => {
      if (entry.startTime && entry.endTime) {
        const seconds = calculateDuration(entry.startTime, entry.endTime);
        const hours = seconds / 3600;
        const ticket = entry.issue || 'No ticket';
        const currentHours = hoursMap.get(ticket) || 0;
        hoursMap.set(ticket, currentHours + hours);

        // Keep the first non-empty description per ticket
        if (entry.description && !descriptionMap.has(ticket)) {
          descriptionMap.set(ticket, entry.description);
        }
      }
    });

    // Convert to array and sort by hours (descending)
    return Array.from(hoursMap.entries())
      .map(([ticket, hours]) => ({
        ticket,
        hours,
        description: descriptionMap.get(ticket) || '',
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [entries]);

  // Format hours for display
  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Custom tile content for calendar
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = date.toISOString().split('T')[0];
      const hours = hoursByDay.get(dateStr);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Determine color and opacity based on hours worked
      let textColor = '#9e9e9e'; // Default gray for incomplete
      let opacity = 1;

      if (isWeekend) {
        opacity = 0; // Invisible for weekends
      } else if (hours && hours > 8) {
        textColor = '#ff9800'; // Orange for more than 8 hours
      } else if (hours && hours > 0) {
        textColor = '#000000'; // Black for normal hours
      }

      // Show hours if available, otherwise show 0h 00m for all days
      const displayText = hours ? formatHours(hours) : '0h 00m';

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '60px',
          }}
        >
          <Typography
            variant="caption"
            fontWeight="bold"
            sx={{ color: textColor, opacity }}
          >
            {displayText}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  // Custom tile styling
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = date.toISOString().split('T')[0];
      const hours = hoursByDay.get(dateStr);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDay = date < today;
      const isToday = date.toDateString() === today.toDateString();

      if (isWeekend) {
        return 'weekend-tile';
      }
      if (isToday) {
        return 'today-tile';
      }
      if (hours) {
        return 'has-hours';
      }
      if (isPastDay) {
        return 'incomplete-day';
      }
    }
    return '';
  };

  // Colors for bar chart
  const COLORS = [
    '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0',
    '#00BCD4', '#8BC34A', '#FF5722', '#673AB7', '#3F51B5',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Statistics</DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="stats tabs">
            <Tab label="Hours by Day" id="stats-tab-0" aria-controls="stats-tabpanel-0" />
            <Tab label="Hours by Ticket" id="stats-tab-1" aria-controls="stats-tabpanel-1" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <style>{`
              .react-calendar {
                width: 100%;
                border: none;
                font-family: inherit;
              }
              .react-calendar__tile {
                min-height: 80px;
                padding: 8px;
              }
              .react-calendar__tile.has-hours {
                background-color: #e3f2fd;
              }
              .react-calendar__tile.has-hours:hover {
                background-color: #bbdefb;
              }
              .react-calendar__tile.incomplete-day {
                background-color: #fff9c4;
              }
              .react-calendar__tile.incomplete-day:hover {
                background-color: #fff59d;
              }
              .react-calendar__tile.today-tile {
                background-color: #1976d2;
                color: white;
                font-weight: bold;
              }
              .react-calendar__tile.today-tile:hover {
                background-color: #1565c0;
              }
              .react-calendar__tile.today-tile .MuiTypography-root {
                color: white !important;
              }
              .react-calendar__tile.weekend-tile {
                background-color: transparent;
                pointer-events: none;
              }
              .react-calendar__tile--active {
                background-color: #2196F3 !important;
                color: white;
              }
              .react-calendar__tile--active .MuiTypography-root {
                color: white !important;
              }
            `}</style>
            <Calendar
              tileContent={tileContent}
              tileClassName={tileClassName}
              locale={locale}
            />
            <Box sx={{ mt: 3, width: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Grand Total: {formatHours(Array.from(hoursByDay.values()).reduce((sum, h) => sum + h, 0))}
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {hoursByTicket.length > 0 ? (
            <Box>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={hoursByTicket}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="ticket"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatHours(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="hours" animationDuration={1000}>
                    {hoursByTicket.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="hours"
                      position="top"
                      formatter={(value) => formatHours(Number(value))}
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Total: {formatHours(hoursByTicket.reduce((sum, t) => sum + t.hours, 0))}
                </Typography>
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    Breakdown by Ticket:
                  </Typography>
                  {hoursByTicket.map((item, index) => {
                    const summary = issueDetails?.[item.ticket.toUpperCase()]?.fields.summary;
                    return (
                      <Box key={item.ticket} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                        <Typography variant="body2" sx={{ minWidth: 0 }}>
                          <span style={{ color: COLORS[index % COLORS.length], fontWeight: 'bold' }}>■</span>{' '}
                          <strong>{item.ticket}</strong>
                          {summary && (
                            <span style={{ color: '#666', marginLeft: 4 }}>— {summary}</span>
                          )}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                          {formatHours(item.hours)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Paper>
              </Box>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              No data to display
            </Typography>
          )}
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
