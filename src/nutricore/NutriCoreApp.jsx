import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Apple, TrendingUp, Timer, BarChart2, Settings2 } from 'lucide-react';
import { NCProvider, useNutriCore } from './NCContext';
import FoodDbDownloader, { isFoodDbReady } from './FoodDbDownloader';
import DiaryScreen     from './DiaryScreen';
import TrendsScreen    from './TrendsScreen';
import FastingScreen   from './FastingScreen';
import FoodsScreen     from './FoodsScreen';
import GoalsScreen     from './GoalsScreen';
import DataTab         from './DataTab';
import SettingsScreen  from './SettingsScreen';
import OnboardingModal from './OnboardingModal';
import { NavBar, TopBar, IconButton, useBackClose } from '../ui';
import './NutriCore.css';

const TABS = [
  { id: 'diary',   label: 'Diary',   Icon: BookOpen   },
  { id: 'trends',  label: 'Trends',  Icon: TrendingUp },
  { id: 'data',    label: 'Data',    Icon: BarChart2  },
  { id: 'foods',   label: 'Foods',   Icon: Apple      },
  { id: 'fasting', label: 'Fasting', Icon: Timer      },
];

const TAB_SUBTITLES = {
  diary:   'Food Diary',
  trends:  'Calorie & Weight',
  data:    'Nutrient Report',
  foods:   'Foods & Meals',
  fasting: 'Fasting Timer',
};

export default function NutriCoreApp() {
  return (
    <NCProvider>
      <NutriCoreInner />
    </NCProvider>
  );
}

function NutriCoreInner() {
  const { ready, initError, profile, refreshProfile } = useNutriCore();
  const [tab,          setTab]          = useState('diary');
  const [needsFoodDb,  setNeedsFoodDb]  = useState(() => !isFoodDbReady());
  const [showSettings, setShowSettings] = useState(false);
  const [showGoals,    setShowGoals]    = useState(false);
  const navigate = useNavigate();

  // Onboarding is needed whenever the loaded profile hasn't completed it.
  const onboarding = !!profile && !profile.onboardingComplete;

  // Back closes the full-screen Settings / Goals overlays instead of leaving the app.
  useBackClose(() => setShowSettings(false), showSettings);
  useBackClose(() => setShowGoals(false), showGoals);

  if (!ready) {
    return (
      <div className="app-shell nc-app">
        <div className="nc-loader">Setting up NutriCore…</div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="app-shell nc-app" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 15, color: 'var(--nc-warn)', textAlign: 'center' }}>Failed to open database</div>
        <div style={{ fontSize: 12, color: 'var(--nc-text3)', textAlign: 'center' }}>{initError}</div>
        <button className="nc-save-btn" style={{ width: 'auto', padding: '10px 24px' }}
          onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  return (
    <div className="app-shell nc-app">
      {/* Top bar */}
      <TopBar
        onBack={() => navigate('/')}
        title="NutriCore"
        subtitle={TAB_SUBTITLES[tab]}
        right={
          <IconButton
            icon={Settings2}
            size={17}
            onClick={() => setShowSettings(true)}
            style={{ borderRadius: 10, width: 34, height: 34 }}
          />
        }
      />

      {/* Screen — must be a flex column so child .nc-screen { flex:1 } expands */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {tab === 'diary'   && <DiaryScreen />}
        {tab === 'trends'  && <TrendsScreen />}
        {tab === 'data'    && <DataTab />}
        {tab === 'foods'   && <FoodsScreen />}
        {tab === 'fasting' && <FastingScreen />}
      </div>

      {/* Bottom nav */}
      <NavBar tabs={TABS} activeId={tab} onSelect={setTab} iconSize={18} />

      {/* Settings overlay */}
      {showSettings && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 300 }}>
          <SettingsScreen
            onClose={() => setShowSettings(false)}
            onOpenGoals={() => { setShowSettings(false); setShowGoals(true); }}
          />
        </div>
      )}

      {/* Goals & targets — now reached from Settings */}
      {showGoals && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 310, background: 'var(--nc-bg)', display: 'flex', flexDirection: 'column' }}>
          <TopBar title="Goals" subtitle="Goals & Targets" onBack={() => setShowGoals(false)} backLabel="Settings" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <GoalsScreen />
          </div>
        </div>
      )}

      {/* Onboarding */}
      {onboarding && (
        <OnboardingModal onComplete={refreshProfile} />
      )}

      {/* One-time food database download */}
      {needsFoodDb && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
          <FoodDbDownloader onDone={() => setNeedsFoodDb(false)} />
        </div>
      )}
    </div>
  );
}
