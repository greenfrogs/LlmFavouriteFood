import type { Dish } from '../types';
import { FoodCard } from './FoodCard';

interface DuelScreenProps {
  pair: [Dish, Dish];
  onSelect: (winner: Dish) => void;
}

export const DuelScreen = ({ pair, onSelect }: DuelScreenProps) => {
  const [dishA, dishB] = pair;

  return (
    <div className="h-screen w-full bg-gradient-to-b from-orange-50 to-rose-50 p-3 md:p-5 overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <p className="text-xs uppercase tracking-widest text-orange-600 font-semibold mb-1 text-center">
          Duel Round
        </p>
        <h2 className="text-xl md:text-3xl font-bold text-gray-900 text-center mb-1">
          Pick Your Winner
        </h2>
        <p className="text-sm md:text-base text-gray-600 text-center mb-4 md:mb-5">
          Tap The Dish You Want To Advance.
        </p>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0">
          <div className="rounded-xl md:rounded-2xl overflow-hidden shadow-lg min-h-0">
            <FoodCard
              key={dishA.id}
              dish={dishA}
              onClick={() => onSelect(dishA)}
              featured={true}
              className="h-full w-full"
            />
          </div>

          <div className="rounded-xl md:rounded-2xl overflow-hidden shadow-lg min-h-0">
            <FoodCard
              key={dishB.id}
              dish={dishB}
              onClick={() => onSelect(dishB)}
              featured={true}
              className="h-full w-full"
            />
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div className="bg-white rounded-full p-3 md:p-4 shadow-2xl border-4 border-yellow-400">
              <span className="text-xl md:text-2xl font-black text-gray-800">VS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
