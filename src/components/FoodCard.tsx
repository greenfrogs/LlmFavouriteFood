import { useState } from 'react';
import type { Dish } from '../types';
import { ChefHat } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface FoodCardProps {
  dish: Dish;
  onClick?: () => void;
  className?: string;
  featured?: boolean;
}

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const FoodCard = ({ dish, onClick, className, featured }: FoodCardProps) => {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const displayName = toTitleCase(dish.name);

  const showNoImageFallback = !dish.image || failedImageSrc === dish.image;
  const imageFitClasses = 'object-cover';
  const cardBackgroundClass = featured ? 'bg-slate-900' : 'bg-white';
  const placeholderBackgroundClass = featured
    ? 'bg-slate-800 text-slate-200'
    : 'bg-gray-200 text-gray-500';
  const interactionClasses = featured
    ? 'transition-opacity active:opacity-90'
    : 'transition-transform hover:scale-105 active:scale-95';

  return (
    <div 
      onClick={onClick}
      className={twMerge(
        "relative overflow-hidden rounded-xl shadow-lg cursor-pointer group",
        interactionClasses,
        cardBackgroundClass,
        featured ? "h-full w-full" : "h-64 w-full",
        className
      )}
    >
      {!showNoImageFallback && (
        <>
          <img
            key={dish.image}
            src={dish.image}
            alt={displayName}
            className={twMerge(
              'w-full h-full',
              imageFitClasses
            )}
            onError={() => {
              setFailedImageSrc(dish.image);
            }}
            loading="lazy"
          />
        </>
      )}

      {showNoImageFallback && (
        <div className={twMerge("w-full h-full flex flex-col items-center justify-center", placeholderBackgroundClass)}>
          <ChefHat size={48} className="mb-2" />
          <span className="text-sm font-medium">No Image</span>
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4 pt-12">
        <h3 className="text-white font-bold text-xl drop-shadow-md leading-tight break-words">
          {displayName}
        </h3>
        {dish.cuisines.length > 0 && (
          <p className="text-white/90 text-sm drop-shadow-sm truncate">
            {dish.cuisines.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
};
