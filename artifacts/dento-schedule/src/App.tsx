import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import universityLogo from './Al-ameen-Logo-350.png';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type ScheduleSession =
  | {
      time: string;
      subjectId: string;
      subject: string;
      note?: string;
    }
  | {
      time: string;
      groups: [string, string];
    };

type ScheduleDay = {
  key: string;
  title: string;
  summary: string;
  sessions: ScheduleSession[];
};

const scheduleDays: ScheduleDay[] = [
  {
    key: 'saturday',
    title: 'Saturday schedule',
    summary: '4 sessions\n8:00 AM – 2:00 PM',
    sessions: [
      { time: '8:00 – 9:00 AM', subjectId: 'orthodontics', subject: 'Orthodontics' },
      { time: '9:00 – 10:00 AM', subjectId: 'periodontics', subject: 'Periodontics' },
      { time: '10:00 AM – 12:00 PM', groups: ['Orthodontics', 'Periodontics'] },
      { time: '12:00 – 2:00 PM', groups: ['Periodontics', 'Orthodontics'] },
    ],
  },
  {
    key: 'sunday',
    title: 'Sunday schedule',
    summary: '4 sessions\n8:00 AM – 2:00 PM',
    sessions: [
      { time: '8:00 – 9:00 AM', subjectId: 'prosthodontics', subject: 'Prosthodontics' },
      { time: '9:00 – 10:00 AM', subjectId: 'pedodontics', subject: 'Pedodontics' },
      { time: '10:00 AM – 12:00 PM', groups: ['Prosthodontics', 'Pedodontics'] },
      { time: '12:00 – 2:00 PM', groups: ['Pedodontics', 'Prosthodontics'] },
    ],
  },
  {
    key: 'monday',
    title: 'Monday schedule',
    summary: '3 sessions\n8:00 AM – 12:00 PM',
    sessions: [
      {
        time: '8:00 – 9:00 AM',
        subjectId: 'general-medicine',
        subject: 'General Medicine',
        note: 'Midterm notes uploaded',
      },
      { time: '9:00 – 10:00 AM', subjectId: 'oral-surgery', subject: 'Oral Surgery' },
      { time: '10:00 AM – 12:00 PM', groups: ['Oral Surgery Lab', 'Oral Surgery Lab'] },
    ],
  },
  {
    key: 'tuesday',
    title: 'Tuesday schedule',
    summary: '4 sessions\n8:00 AM – 2:00 PM',
    sessions: [
      { time: '8:00 – 9:00 AM', subjectId: 'general-surgery', subject: 'General Surgery' },
      { time: '9:00 – 10:00 AM', subjectId: 'oral-pathology', subject: 'Oral Pathology' },
      { time: '10:00 AM – 12:00 PM', groups: ['Oral Pathology', '-'] },
      { time: '12:00 – 2:00 PM', groups: ['-', 'Oral Pathology'] },
    ],
  },
  {
    key: 'wednesday',
    title: 'Wednesday schedule',
    summary: '3 sessions\n8:00 AM – 2:00 PM',
    sessions: [
      { time: '8:00 – 9:00 AM', subjectId: 'conservative', subject: 'Conservative' },
      { time: '10:00 AM – 12:00 PM', groups: ['Conservative', '-'] },
      { time: '12:00 – 2:00 PM', groups: ['-', 'Conservative'] },
    ],
  },
];

function ScheduleDayView({
  day,
  alerts,
}: {
  day: ScheduleDay;
  alerts: Record<string, string>;
}) {
  return (
    <section className="schedule-container" aria-label={day.title} id={`schedule-${day.key}`}>
      <div className="schedule-heading">
        <h2>{day.title}</h2>
        <p>
          {day.summary.split('\n')[0]}
          <br />
          {day.summary.split('\n')[1]}
        </p>
      </div>

      {day.sessions.map((session) => (
        <div className="time-block" key={`${day.title}-${session.time}`}>
          <div className="time">{session.time}</div>
          {'subjectId' in session ? (
            <div className="subject-card" id={`card-${session.subjectId}`}>
              <h2>{session.subject}</h2>
              {session.note && <span className="note-badge">{session.note}</span>}
              {alerts[session.subjectId] && (
                <span className="class-alert">{alerts[session.subjectId]}</span>
              )}
            </div>
          ) : (
            <div className="subject-card split-group">
              <div className="group-col">
                <h3>Group A</h3>
                <p>{session.groups[0]}</p>
              </div>
              <div aria-hidden="true" className="divider" />
              <div className="group-col">
                <h3>Group B</h3>
                <p>{session.groups[1]}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Home() {
  const [selectedDate, setSelectedDate] = useState('Mon21');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState('monday');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<Record<string, string>>({});
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [editSubject, setEditSubject] = useState('general-medicine');
  const [alertText, setAlertText] = useState('');
  const [alertDate, setAlertDate] = useState('');
  const dates = [
    { day: 'Sat', num: '19', label: '', scheduleKey: 'saturday' },
    { day: 'Sun', num: '20', label: 'Today', scheduleKey: 'sunday' },
    { day: 'Mon', num: '21', label: 'Tomorrow', scheduleKey: 'monday' },
    { day: 'Tue', num: '22', label: '', scheduleKey: 'tuesday' },
    { day: 'Wed', num: '23', label: '', scheduleKey: 'wednesday' },
    { day: 'Sat', num: '26', label: '', scheduleKey: 'saturday' },
    { day: 'Sun', num: '27', label: '', scheduleKey: 'sunday' },
    { day: 'Mon', num: '28', label: '', scheduleKey: 'monday' },
    { day: 'Tue', num: '29', label: '', scheduleKey: 'tuesday' },
    { day: 'Wed', num: '30', label: '', scheduleKey: 'wednesday' },
  ];

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim() === 'Dent007' && password.trim() === 'Dent007') {
      setLoginError(false);
      setIsAdmin(true);
      setIsUnlocked(true);
      return;
    }

    setLoginError(true);
  }

  function handleSaveAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = alertText.trim();

    if (text) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expirationDate = alertDate
        ? new Date(`${alertDate}T00:00:00`)
        : null;

      if (!expirationDate || today <= expirationDate) {
        setAlerts((currentAlerts) => ({
          ...currentAlerts,
          [editSubject]: text,
        }));
      }
    }

    setIsEditScheduleModalOpen(false);
    setAlertText('');
    setAlertDate('');
  }

  if (!isUnlocked) {
    return (
      <div className="gateway-overlay">
        <div className="gateway-card">
          {!showLogin ? (
            <>
              <div className="uni-branding">
                <img
                  alt="Al-Ameen University Logo"
                  className="uni-logo"
                  src={universityLogo}
                />
                <p className="uni-subtitle">
                  Al-Ameen University • College of Dentistry
                </p>
              </div>
              <h2>Welcome to DentoSchedule</h2>
              <p>Please select your role to continue:</p>
              <button
                className="gateway-btn"
                onClick={() => {
                  setIsAdmin(false);
                  setIsUnlocked(true);
                }}
                type="button"
              >
                Student / User
              </button>
              <button
                className="gateway-btn outline"
                onClick={() => {
                  setShowLogin(true);
                  setLoginError(false);
                }}
                type="button"
              >
                Admin Login
              </button>
            </>
          ) : (
            <form onSubmit={handleLogin}>
              <h2>Admin Login</h2>
              <input
                aria-label="Username"
                className="gateway-input"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                type="text"
                value={username}
              />
              <input
                aria-label="Password"
                className="gateway-input"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
              {loginError && (
                <p className="error-msg" role="alert">
                  Incorrect username or password.
                </p>
              )}
              <button className="gateway-btn" type="submit">
                Login
              </button>
              <button
                className="gateway-btn text-only"
                onClick={() => {
                  setShowLogin(false);
                  setLoginError(false);
                }}
                type="button"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-shell">
      {isAdmin && (
        <section className="admin-panel" aria-label="Admin Dashboard">
          <h2>Admin Dashboard</h2>
          <div className="admin-actions">
            <button
              className="admin-btn"
              onClick={() => setIsEditScheduleModalOpen(true)}
              type="button"
            >
              Edit Schedule
            </button>
            <button
              className="admin-btn"
              onClick={() => setIsUploadModalOpen(true)}
              type="button"
            >
              Upload PDF Notes
            </button>
            <button
              className="admin-btn"
              onClick={() => setIsQuizModalOpen(true)}
              type="button"
            >
              Add Quiz
            </button>
          </div>
        </section>
      )}
      {isUploadModalOpen && (
        <div
          aria-labelledby="upload-lecture-title"
          aria-modal="true"
          className="admin-modal"
          role="dialog"
        >
          <form
            className="modal-content"
            onSubmit={(event) => {
              event.preventDefault();
              setIsUploadModalOpen(false);
            }}
          >
            <h2 id="upload-lecture-title">Upload Lecture PDF</h2>
            <label htmlFor="pdf-subject">Select Subject:</label>
            <select className="admin-input" defaultValue="general-medicine" id="pdf-subject">
              <option value="orthodontics">Orthodontics</option>
              <option value="periodontics">Periodontics</option>
              <option value="prosthodontics">Prosthodontics</option>
              <option value="pedodontics">Pedodontics</option>
              <option value="general-medicine">General Medicine</option>
              <option value="oral_surgery">Oral Surgery</option>
              <option value="general_surgery">General Surgery</option>
              <option value="oral_pathology">Oral Pathology</option>
              <option value="conservative">Conservative</option>
            </select>
            <label htmlFor="pdf-file">Choose File:</label>
            <input accept=".pdf" className="admin-input" id="pdf-file" type="file" />
            <div className="modal-actions">
              <button className="admin-btn" type="submit">
                Upload
              </button>
              <button
                className="admin-btn cancel-btn"
                onClick={() => setIsUploadModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {isQuizModalOpen && (
        <div
          aria-labelledby="add-quiz-title"
          aria-modal="true"
          className="admin-modal"
          role="dialog"
        >
          <form
            className="modal-content"
            onSubmit={(event) => {
              event.preventDefault();
              setIsQuizModalOpen(false);
            }}
          >
            <h2 id="add-quiz-title">Add Interactive Quiz</h2>
            <label htmlFor="quiz-subject">Select Subject:</label>
            <select className="admin-input" defaultValue="general-medicine" id="quiz-subject">
              <option value="orthodontics">Orthodontics</option>
              <option value="periodontics">Periodontics</option>
              <option value="prosthodontics">Prosthodontics</option>
              <option value="pedodontics">Pedodontics</option>
              <option value="general-medicine">General Medicine</option>
              <option value="oral_surgery">Oral Surgery</option>
              <option value="general_surgery">General Surgery</option>
              <option value="oral_pathology">Oral Pathology</option>
              <option value="conservative">Conservative</option>
            </select>
            <label htmlFor="quiz-title">Quiz Title:</label>
            <input
              className="admin-input"
              id="quiz-title"
              placeholder="e.g., Surgery Midterm MCQs"
              type="text"
            />
            <label htmlFor="quiz-link">Quiz Link (URL):</label>
            <input
              className="admin-input"
              id="quiz-link"
              placeholder="Paste link here"
              type="url"
            />
            <div className="modal-actions">
              <button className="admin-btn" type="submit">
                Add Quiz
              </button>
              <button
                className="admin-btn cancel-btn"
                onClick={() => setIsQuizModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {isEditScheduleModalOpen && (
        <div
          aria-labelledby="edit-schedule-title"
          aria-modal="true"
          className="admin-modal"
          role="dialog"
        >
          <form
            className="modal-content"
            onSubmit={handleSaveAlert}
          >
            <h2 id="edit-schedule-title">Edit Schedule &amp; Alerts</h2>
            <label htmlFor="edit-subject">Select Subject:</label>
            <select
              className="admin-input"
              id="edit-subject"
              onChange={(event) => setEditSubject(event.target.value)}
              value={editSubject}
            >
              <option value="general-medicine">General Medicine</option>
              <option value="oral-surgery">Oral Surgery</option>
              <option value="prosthodontics">Prosthodontics</option>
            </select>
            <label htmlFor="alert-text">Temporary Alert (Optional):</label>
            <input
              className="admin-input"
              id="alert-text"
              onChange={(event) => setAlertText(event.target.value)}
              placeholder="e.g., Contains an exam! ⚠️"
              type="text"
              value={alertText}
            />
            <label htmlFor="alert-date">Alert Expiration Date:</label>
            <input
              className="admin-input"
              id="alert-date"
              onChange={(event) => setAlertDate(event.target.value)}
              type="date"
              value={alertDate}
            />
            <div className="modal-actions">
              <button className="admin-btn" type="submit">
                Save Changes
              </button>
              <button
                className="admin-btn cancel-btn"
                onClick={() => setIsEditScheduleModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
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
                className={`date-card ${selectedDate === date.day + date.num ? 'active-tomorrow is-selected' : date.day === 'Sun' && date.num === '20' ? 'today' : ''}`}
                key={`${date.day}-${date.num}`}
                onClick={() => {
                  setSelectedDate(date.day + date.num);
                  setSelectedScheduleDay(date.scheduleKey);
                }}
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

      {scheduleDays
        .filter((day) => day.key === selectedScheduleDay)
        .map((day) => (
          <ScheduleDayView alerts={alerts} day={day} key={day.key} />
        ))}
      <footer className="app-footer">
        <p>
          Developed &amp; Managed by <strong>Tqy Malik</strong> &amp;{' '}
          <strong>Mustafa Mahdi</strong>
        </p>
        <a className="contact-link" href="mailto:mustafa.mahdi.hu@gmail.com">
          Contact Admin (mustafa.mahdi.hu@gmail.com)
        </a>
      </footer>
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
