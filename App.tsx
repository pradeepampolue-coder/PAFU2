
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Chat from './components/Chat';
import LocationSharing from './components/LocationSharing';
import PrivateVault from './components/PrivateVault';
import Calling from './components/Calling';
import { AppView, User, Message, Location, VaultMedia } from './types';
import { PRE_APPROVED_USERS, INACTIVITY_TIMEOUT } from './constants';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [messages, setMessages] = useState<Message[]>([]);
  const [locations, setLocations] = useState<Record<string, Location>>({});
  const [vault, setVault] = useState<VaultMedia[]>([]);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Helper to generate a unique but consistent Peer ID for the users
  const getPeerId = (email: string) => `sanctuary-v1-${btoa(email).replace(/=/g, '')}`;

  // Sync state with localStorage
  const loadFromStorage = useCallback(() => {
    const savedMessages = localStorage.getItem('pair_messages');
    if (savedMessages) setMessages(JSON.parse(savedMessages));

    const savedVault = localStorage.getItem('pair_vault');
    if (savedVault) setVault(JSON.parse(savedVault));

    const savedLocations = localStorage.getItem('pair_locations');
    if (savedLocations) setLocations(JSON.parse(savedLocations));
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Handle incoming data from Peer
  const handleIncomingData = (data: any) => {
    if (data.type === 'MSG') {
      setMessages(prev => {
        const updated = [...prev, data.payload];
        localStorage.setItem('pair_messages', JSON.stringify(updated));
        return updated;
      });
    } else if (data.type === 'LOC') {
      setLocations(prev => ({ ...prev, [data.senderId]: data.payload }));
    } else if (data.type === 'CLEAR_CHAT') {
      setMessages([]);
      localStorage.setItem('pair_messages', JSON.stringify([]));
    }
  };

  // Initialize PeerJS when user logs in
  useEffect(() => {
    if (!currentUser) return;

    const myId = getPeerId(currentUser.email);
    const otherUser = PRE_APPROVED_USERS.find(u => u.id !== currentUser.id)!;
    const partnerId = getPeerId(otherUser.email);

    const peer = new Peer(myId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      // Try to connect to the partner
      const connectToPartner = () => {
        const conn = peer.connect(partnerId);
        setupConnection(conn);
      };
      
      // Attempt connection immediately and then periodically if failed
      connectToPartner();
      const retryInterval = setInterval(() => {
        if (!connRef.current || !connRef.current.open) {
          connectToPartner();
        }
      }, 5000);

      return () => clearInterval(retryInterval);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('call', (call) => {
      setActiveCall(call);
      setIsIncomingCall(true);
    });

    const setupConnection = (conn: DataConnection) => {
      conn.on('open', () => {
        connRef.current = conn;
        setIsOtherUserOnline(true);
        console.log("Connected to partner!");
      });

      conn.on('data', (data) => {
        handleIncomingData(data);
      });

      conn.on('close', () => {
        setIsOtherUserOnline(false);
        connRef.current = null;
      });
    };

    return () => {
      peer.destroy();
    };
  }, [currentUser]);

  // Inactivity Logout
  useEffect(() => {
    if (!currentUser) return;
    let timeoutId: number;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setCurrentUser(null);
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousemove', 'keypress', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
      clearTimeout(timeoutId);
    };
  }, [currentUser]);

  const handleLogin = (email: string) => {
    const user = PRE_APPROVED_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setCurrentUser({ ...user, lastLogin: new Date().toISOString(), isOnline: true });
    }
  };

  const sendMessage = (text: string) => {
    if (!currentUser) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      text,
      timestamp: Date.now(),
      read: false
    };

    // Update local state
    const updated = [...messages, newMessage];
    setMessages(updated);
    localStorage.setItem('pair_messages', JSON.stringify(updated));

    // Send to peer if online
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'MSG', payload: newMessage, senderId: currentUser.id });
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.setItem('pair_messages', JSON.stringify([]));
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'CLEAR_CHAT' });
    }
  };

  const updateLocation = (loc: Location) => {
    if (!currentUser) return;
    const updatedLocations = { ...locations, [currentUser.id]: loc };
    setLocations(updatedLocations);
    localStorage.setItem('pair_locations', JSON.stringify(updatedLocations));

    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'LOC', payload: loc, senderId: currentUser.id });
    }
  };

  const addToVault = (media: VaultMedia) => {
    const updated = [...vault, media];
    setVault(updated);
    localStorage.setItem('pair_vault', JSON.stringify(updated));
  };

  const removeFromVault = (id: string) => {
    const updated = vault.filter(v => v.id !== id);
    setVault(updated);
    localStorage.setItem('pair_vault', JSON.stringify(updated));
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const otherUser = PRE_APPROVED_USERS.find(u => u.id !== currentUser.id)!;
  const displayOtherUser = { ...otherUser, isOnline: isOtherUserOnline };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {isIncomingCall && (
        <Calling 
          isIncoming={true} 
          onClose={() => {
            if(activeCall) activeCall.close();
            setIsIncomingCall(false);
          }} 
          callerName={displayOtherUser.name}
          onAccept={(stream) => {
            if (activeCall) {
              activeCall.answer(stream);
              setIsIncomingCall(false);
              setActiveView('calling');
            }
          }}
        />
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        {activeView === 'dashboard' && (
          <Dashboard 
            currentUser={currentUser} 
            otherUser={displayOtherUser} 
            onNavigate={setActiveView}
          />
        )}
        {activeView === 'chat' && (
          <Chat 
            messages={messages} 
            onSend={sendMessage} 
            onClear={clearChat}
            currentUserId={currentUser.id}
            onBack={() => setActiveView('dashboard')}
          />
        )}
        {activeView === 'location' && (
          <LocationSharing 
            locations={locations} 
            onUpdate={updateLocation} 
            otherUser={displayOtherUser}
            currentUserId={currentUser.id}
            onBack={() => setActiveView('dashboard')}
          />
        )}
        {activeView === 'vault' && (
          <PrivateVault 
            media={vault} 
            onAdd={addToVault} 
            onRemove={removeFromVault}
            onBack={() => setActiveView('dashboard')}
          />
        )}
        {activeView === 'calling' && (
          <Calling 
            isIncoming={false} 
            onClose={() => setActiveView('dashboard')} 
            callerName={displayOtherUser.name}
            peer={peerRef.current}
            targetPeerId={getPeerId(otherUser.email)}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 flex justify-around items-center p-4 z-40 pb-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'dashboard' ? 'text-rose-500' : 'text-slate-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          <span className="text-[9px] uppercase tracking-widest font-bold">Home</span>
        </button>
        <button onClick={() => setActiveView('chat')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'chat' ? 'text-rose-500' : 'text-slate-500'}`}>
          <div className="relative">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
             {isOtherUserOnline && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-slate-900"></span>}
          </div>
          <span className="text-[9px] uppercase tracking-widest font-bold">Chat</span>
        </button>
        <button onClick={() => setActiveView('location')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'location' ? 'text-rose-500' : 'text-slate-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span className="text-[9px] uppercase tracking-widest font-bold">GPS</span>
        </button>
        <button onClick={() => setActiveView('vault')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'vault' ? 'text-rose-500' : 'text-slate-500'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          <span className="text-[9px] uppercase tracking-widest font-bold">Vault</span>
        </button>
        <button onClick={() => setCurrentUser(null)} className="flex flex-col items-center gap-1 text-slate-500 hover:text-rose-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          <span className="text-[9px] uppercase tracking-widest font-bold">Exit</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
