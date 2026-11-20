import React from 'react';
import { RaceStandingsEntry, TOTAL_LAPS } from '../game/types';

interface FinishModalProps {
  standings: RaceStandingsEntry[];
  onPlayAgain: () => void;
  onChangeKart: () => void;
}

function formatFinishTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export const FinishModal: React.FC<FinishModalProps> = ({
  standings,
  onPlayAgain,
  onChangeKart,
}) => {
  const playerRow = standings.find((s) => s.isPlayer);
  const playerRank = playerRow?.rank ?? 1;
  const headline =
    playerRank === 1
      ? '1st Place Victory!'
      : playerRank === 2
      ? '2nd Place Podium!'
      : playerRank === 3
      ? '3rd Place Finish!'
      : 'Race Complete';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b1017]/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-title"
        className="w-full max-w-lg rounded-2xl bg-[#18202c] border-2 border-[#FACC15] p-6 sm:p-7 shadow-2xl"
      >
        <div className="text-center mb-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FACC15] mb-1">
            Final Standings · {TOTAL_LAPS} Laps
          </div>
          <h2
            id="finish-title"
            className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight"
          >
            {headline}
          </h2>
        </div>

        {/* Standings Table */}
        <div className="rounded-xl bg-[#10161f] border border-white/10 overflow-hidden mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3.5">Pos</th>
                <th className="py-2.5 px-3.5">Driver</th>
                <th className="py-2.5 px-3.5 text-right">Time</th>
                <th className="py-2.5 px-3.5 text-right">Best Lap</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 last:border-b-0 ${
                    row.isPlayer ? 'bg-[#FACC15]/12' : ''
                  }`}
                >
                  <td className="py-2.5 px-3.5 font-display text-base font-black tabular-nums text-[#FACC15]">
                    #{row.rank}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-sm shrink-0 border border-black/40"
                        style={{ backgroundColor: row.primaryColor }}
                      />
                      <span className="font-display text-sm font-bold text-white">
                        {row.driverName}
                        {row.isPlayer ? ' (You)' : ''}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-mono text-xs font-bold text-slate-200 tabular-nums">
                    {formatFinishTime(row.finishTime)}
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-mono text-xs text-slate-400 tabular-nums">
                    {row.bestLapTime !== null ? formatFinishTime(row.bestLapTime) : '--:--.--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 rounded-xl bg-[#FACC15] px-6 py-3 font-display text-base font-extrabold text-[#14181F] shadow-[0_3px_0_#A16207] hover:brightness-105 cursor-pointer whitespace-nowrap"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onChangeKart}
            className="rounded-xl bg-[#273244] border border-white/15 px-5 py-3 font-display text-sm font-bold text-white hover:bg-[#313f55] cursor-pointer whitespace-nowrap"
          >
            Change Kart
          </button>
        </div>
      </div>
    </div>
  );
};
