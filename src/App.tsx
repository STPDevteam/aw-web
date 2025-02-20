import { useState } from 'react';
import Game from './components/Game.tsx';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">     
      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <Game />
      </div>
    </main>
  );
}

