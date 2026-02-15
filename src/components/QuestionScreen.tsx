import type { Question } from '../types';

interface QuestionScreenProps {
  question: Question;
  onAnswer: (answer: string) => void;
}

export const QuestionScreen = ({ question, onAnswer }: QuestionScreenProps) => {
  const labels = question.optionLabels ?? question.options;
  const hints = question.optionHints ?? question.options.map(() => 'Tap To Narrow Your Options');
  const optionsGridClassName =
    question.options.length === 3
      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 w-full max-w-5xl mx-auto'
      : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-5xl mx-auto';

  return (
    <div className="h-screen w-full flex items-center justify-center p-3 md:p-6 text-center animate-fade-in bg-gradient-to-b from-orange-50 to-rose-50 overflow-hidden">
      <div className="w-full max-w-5xl">
        <p className="text-xs uppercase tracking-widest text-orange-600 font-semibold mb-1 md:mb-2">
          Taste Round
        </p>
        <h2 className="text-xl md:text-4xl font-bold mb-2 md:mb-3 text-gray-800">
          {question.text}
        </h2>
        <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-6 max-w-lg mx-auto">
          Pick The Vibe You Want Right Now.
        </p>

        <div className={optionsGridClassName}>
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => onAnswer(option)}
              className="p-4 md:p-5 rounded-2xl text-left transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-md hover:shadow-lg border bg-white/95 border-orange-200 hover:border-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <p className="text-xl md:text-2xl font-extrabold text-gray-900 mb-1 md:mb-2 leading-tight">
                {labels[index]}
              </p>
              <p className="text-sm md:text-base font-semibold text-gray-700">
                {hints[index]}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
