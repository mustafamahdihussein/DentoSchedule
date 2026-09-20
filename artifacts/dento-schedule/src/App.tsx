import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const [selectedDate, setSelectedDate] = useState('Mon21');
  const dates = [
    { day: 'Sun', num: '20', label: 'Today', className: 'today' },
    { day: 'Mon', num: '21', label: 'Tomorrow', className: 'active-tomorrow' },
    { day: 'Tue', num: '22', label: '', className: '' },
    { day: 'Wed', num: '23', label: '', className: '' },
    { day: 'Thu', num: '24', label: '', className: '' },
    { day: 'Fri', num: '25', label: '', className: '' },
    { day: 'Sat', num: '26', label: '', className: '' },
    { day: 'Sun', num: '27', label: '', className: '' },
    { day: 'Mon', num: '28', label: '', className: '' },
    { day: 'Tue', num: '29', label: '', className: '' },
  ];

  return (
    <div className="schedule-shell">
      <header className="schedule-header">
        <div className="schedule-header-inner">
          <div className="eyebrow">Dental Schedule</div>
          <h1 className="schedule-title">Class Schedule</h1>
          <p className="schedule-subtitle">4th Year Dentistry</p>
        </div>
      </header>

      <section className="date-section" aria-label="Schedule dates">
        <div className="date-section-inner">
          <div className="ribbon-label">
            <span>October 2024</span>
            <span>10 day view</span>
          </div>
          <div className="date-ribbon">
            {dates.map((date) => (
              <button
                aria-label={`${date.day} ${date.num}${date.label ? `, ${date.label}` : ''}`}
                className={`date-card ${date.className} ${selectedDate === date.day + date.num ? 'is-selected' : ''}`}
                key={`${date.day}-${date.num}`}
                onClick={() => setSelectedDate(date.day + date.num)}
                type="button"
              >
                <span className="day">{date.day}</span>
                <span className="num">{date.num}</span>
                {date.label && <span className="badge">{date.label}</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="schedule-container">
        <div className="schedule-heading">
          <h2>Monday schedule</h2>
          <p>3 sessions<br />8:00 AM – 12:00 PM</p>
        </div>

        <div className="time-block">
          <div className="time">8:00 – 9:00 AM</div>
          <div className="subject-card">
            <h2>General Medicine</h2>
            <span className="note-badge">Midterm notes uploaded</span>
          </div>
        </div>

        <div className="time-block">
          <div className="time">9:00 – 10:00 AM</div>
          <div className="subject-card">
            <h2>Oral Surgery</h2>
          </div>
        </div>

        <div className="time-block">
          <div className="time">10:00 AM – 12:00 PM</div>
          <div className="subject-card split-group">
            <div className="group-col">
              <h3>Group A</h3>
              <p>Oral Surgery Lab</p>
            </div>
            <div aria-hidden="true" className="divider" />
            <div className="group-col">
              <h3>Group B</h3>
              <p>Oral Surgery Lab</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
