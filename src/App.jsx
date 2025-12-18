/**
 * CSV Dock Tally Application
 * Testing mode - bypasses auth and uses localStorage
 */

import { useState } from 'react';
import Dashboard from './components/Dashboard';

function App() {
  const [testMode] = useState(true);

  const handleLogout = () => {
    // In test mode, just reload the page
    window.location.reload();
  };

  // In test mode, go directly to dashboard
  return <Dashboard onLogout={handleLogout} />;
}

export default App;
