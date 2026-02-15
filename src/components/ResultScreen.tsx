import type { Dish } from '../types';
import { FoodCard } from './FoodCard';

interface ResultScreenProps {
  winner: Dish;
  onRestart: () => void;
}

export const ResultScreen = ({ winner, onRestart }: ResultScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 text-center p-6">
      <h1 className="text-4xl font-black text-green-700 mb-2 animate-bounce">
        Winner Winner!
      </h1>
      <p className="text-xl text-green-600 mb-8">
        Your Delicious Choice Is Served.
      </p>

      <div className="w-full max-w-md h-96 mb-8 transform hover:scale-105 transition-transform duration-500 shadow-2xl rounded-2xl overflow-hidden">
        <FoodCard dish={winner} featured />
      </div>

      <a 
        href={`https://www.wikidata.org/wiki/${winner.id}`} 
        target="_blank" 
        rel="noreferrer"
        className="mb-6 text-blue-500 hover:underline"
      >
        Learn More On Wikidata
      </a>

      <button 
        onClick={onRestart}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-colors text-lg"
      >
        Play Again
      </button>
    </div>
  );
};
