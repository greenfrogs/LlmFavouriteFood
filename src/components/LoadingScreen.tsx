import { Loader } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-orange-50">
      <Loader className="animate-spin text-orange-500 mb-4" size={48} />
      <h2 className="text-xl font-medium text-orange-700 animate-pulse">
        Cooking Up Some Options...
      </h2>
    </div>
  );
};
