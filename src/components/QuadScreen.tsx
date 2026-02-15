import type { Dish } from '../types';
import { FoodCard } from './FoodCard';

interface QuadScreenProps {
  dishes: [Dish, Dish, Dish, Dish];
  onSelect: (winner: Dish) => void;
}

export const QuadScreen = ({ dishes, onSelect }: QuadScreenProps) => {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 grid-rows-2 gap-3 md:gap-4 flex-1 min-h-0">
          {dishes.map((dish, index) => (
            <div
              key={dish.id}
              className="rounded-xl md:rounded-2xl overflow-hidden shadow-lg min-h-0 opacity-0 translate-y-2"
              style={{
                animation: 'quad-card-in 420ms ease-out forwards',
                animationDelay: `${index * 80}ms`,
              }}
            >
              <FoodCard
                dish={dish}
                onClick={() => onSelect(dish)}
                featured={true}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
