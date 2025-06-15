import React from 'react';
import { Navigate, useLocation, Routes, Route } from 'react-router-dom';
import Form from './modules/Form';
import Dashboard from './modules/Dashboard/Index';

// Moved this hook outside the function won't work
const ProtectedRoute = ({ children , auth=false }) => {
  const isLoggedIn = localStorage.getItem('user:token') !== null || false;
  const location = useLocation(); // <-- useLocation to get the current path

  const currentPath = location.pathname;

  // Redirect unauthenticated users to sign in
  if (!isLoggedIn && auth) {
    return <Navigate to="/users/sign_in" />;
  }

  // Redirect logged-in users away from sign-in or sign-up forms
  if (
    isLoggedIn &&
    ['/users/sign_in', '/users/sign_up'].includes(currentPath)
  ) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute auth={true}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/sign_in"
        element={
          <ProtectedRoute>
            <Form isSignInPage={true} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/sign_up"
        element={
          <ProtectedRoute>
            <Form isSignInPage={false} />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
