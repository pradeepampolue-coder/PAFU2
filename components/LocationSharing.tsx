
import React, { useState, useEffect } from 'react';
import { Location, User } from '../types';

interface LocationProps {
  locations: Record<string, Location>;
  onUpdate: (loc: Location) => void;
  otherUser: User;
  currentUserId: string;
  onBack: () => void;
}

const LocationSharing: React.FC<LocationProps> = ({ locations, onUpdate, otherUser, currentUserId, onBack }) => {
  const [isSharing, setIsSharing] = useState(false);
  const myLoc = locations[currentUserId];
  const partnerLoc = locations[otherUser.id];

  const toggleSharing = () => {
    if (!isSharing) {
      if (!navigator.geolocation) {
        alert("Geolocation not supported by your browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsSharing(true);
          onUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now(),
            isActive: true
          });
        },
        (err) => alert("Permission denied or location unavailable."),
        { enableHighAccuracy: true }
      );
    } else {
      setIsSharing(false);
      onUpdate({
        latitude: 0,
        longitude: 0,
        timestamp: Date.now(),
        isActive: false
      });
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col animate-in slide-in-from-right duration-300">
      <header className="p-4 bg-slate-950/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="font-semibold text-slate-200">Where Are We?</h2>
        </div>
        {isSharing && (
          <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Live</span>
          </div>
        )}
      </header>

      <div className="flex-1 relative bg-slate-900 flex items-center justify-center overflow-hidden">
        {/* Mock Map Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative w-full h-full flex flex-col items-center justify-center p-8 space-y-12">
          {/* Partner Status */}
          <div className={`p-6 rounded-3xl border transition-all duration-500 max-w-sm w-full text-center ${
            partnerLoc?.isActive ? 'bg-slate-800 border-blue-500/30' : 'bg-slate-950 border-slate-800 opacity-60'
          }`}>
            <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
              partnerLoc?.isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
            <h3 className="font-semibold mb-1">{otherUser.name}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {partnerLoc?.isActive 
                ? `Located at ${partnerLoc.latitude.toFixed(4)}, ${partnerLoc.longitude.toFixed(4)}` 
                : `${otherUser.name} is not sharing location currently`}
            </p>
            {partnerLoc?.isActive && (
              <div className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-900 py-2 rounded-xl">
                Updated {new Date(partnerLoc.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* User Status */}
          <div className="flex flex-col items-center gap-6 w-full max-w-xs">
            <button
              onClick={toggleSharing}
              className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl ${
                isSharing 
                  ? 'bg-rose-600 text-white hover:bg-rose-500 active:scale-95' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {isSharing ? 'Stop Sharing' : 'Share My Location'}
            </button>
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest leading-loose">
              Sharing is manual. No background tracking.<br/>Only {otherUser.name} can see you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSharing;
