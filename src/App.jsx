import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ExpiringSoon from './pages/ExpiringSoon';
import VanityURLs from './pages/VanityURLs';
import Login from './pages/Login';

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const location = useLocation();

  // Analytics removed


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
        <Route index element={<Dashboard />} />
        <Route path="expiring" element={<ExpiringSoon />} />
        <Route path="vanity" element={<VanityURLs />} />
      </Route>
    </Routes>
  );
}

export default App;
