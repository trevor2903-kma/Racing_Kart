import React from 'react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onBackToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onBackToTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b1017]/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="w-full max-w-sm rounded-2xl bg-[#18202c] border-2 border-[#475569] p-6 shadow-2xl text-center"
      >
        <h2
          id="pause-title"
          className="font-display text-3xl font-black text-white tracking-tight mb-2"
        >
          Race Paused
        </h2>
        <p className="text-sm text-slate-300 mb-6">
          Catch your breath before jumping back onto the circuit.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-xl bg-[#FACC15] px-5 py-3 font-display text-base font-extrabold text-[#14181F] shadow-[0_3px_0_#A16207] hover:brightness-105 cursor-pointer"
          >
            Resume Race
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-xl bg-[#273244] border border-white/15 px-5 py-2.5 font-display text-sm font-bold text-white hover:bg-[#313f55] cursor-pointer"
          >
            Restart Race
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="w-full rounded-xl bg-transparent border border-white/15 px-5 py-2.5 font-display text-sm font-bold text-slate-300 hover:text-white hover:border-white/35 cursor-pointer"
          >
            Back to Title
          </button>
        </div>
      </div>
    </div>
  );
};
