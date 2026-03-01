import React, { createContext, useContext, useState, useEffect } from 'react';

const UserStatusContext = createContext(null);

export function UserStatusProvider({ children }) {
  const [userStatus, setUserStatus] = useState(() => {
    // try reading from localStorage so status survives refresh
    try {
      return localStorage.getItem('userStatus') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (userStatus) {
      try {
        localStorage.setItem('userStatus', userStatus);
      } catch {}
    }
  }, [userStatus]);

  const value = {
    userStatus,
    setUserStatus,
  };

  return (
    <UserStatusContext.Provider value={value}>
      {children}
    </UserStatusContext.Provider>
  );
}

export function useUserStatus() {
  const context = useContext(UserStatusContext);
  if (!context) {
    throw new Error('useUserStatus must be used within a UserStatusProvider');
  }
  return context;
}
