import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewDashboard from './pages/OverviewDashboard';
import AllRecords from './pages/AllRecords';
import ExpiringSoon from './pages/ExpiringSoon';
import VanityURLs from './pages/VanityURLs';
import AkamaiRedirects from './pages/AkamaiRedirects';
import RewriteRules from './pages/RewriteRules';
import Login from './pages/Login';
import { trackUserVisit } from './lib/analytics';

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const location = useLocation();

  useEffect(() => {
    // Check and track if the user is a new or repeated user
    trackUserVisit();
  }, []);

  useEffect(() => {
    // Record page view on path change
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: location.pathname
      });
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewDashboard />} />
        <Route path="records" element={<AllRecords />} />
        <Route path="expiring" element={<ExpiringSoon />} />
        <Route path="vanity" element={<VanityURLs />} />
        <Route path="akamai" element={<AkamaiRedirects />} />
        <Route path="rewrite-rules" element={<RewriteRules />} />
      </Route>
    </Routes>
  );
}

export default App;
