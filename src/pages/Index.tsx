import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CosmicBackdrop } from '@/components/spiral/CosmicBackdrop';

const Index = () => {
  const [visible, setVisible] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const textTimer = setTimeout(() => {
      setVisible(true);
      const buttonTimer = setTimeout(() => setShowButton(true), 1500);
      return () => clearTimeout(buttonTimer);
    }, 1000);
    return () => clearTimeout(textTimer);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* The spiral's own sky, so the way in matches the record */}
      <div className="absolute inset-0">
        <CosmicBackdrop dust />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <div className={`text-center transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-5xl font-extralight tracking-[0.2em] text-white/[0.95] mb-3 [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]">
            You're Here
          </h1>
          <p className="text-lg font-extralight tracking-[0.15em] text-white/75 mb-16 [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
            a moment for reflection
          </p>

          <div className={`transition-opacity duration-700 ${showButton ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => navigate('/spiral')}
              className="text-white/85 hover:text-white bg-[rgba(12,12,20,0.7)] hover:bg-[rgba(20,20,32,0.9)] border border-white/[0.12] backdrop-blur-md text-sm tracking-[0.2em] font-extralight px-6 py-2 rounded-lg transition-all duration-300"
            >
              enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
