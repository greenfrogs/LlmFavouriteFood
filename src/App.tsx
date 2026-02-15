import { useGameEngine } from './hooks/useGameEngine';
import { LoadingScreen } from './components/LoadingScreen';
import { QuestionScreen } from './components/QuestionScreen';
import { DuelScreen } from './components/DuelScreen';
import { QuadScreen } from './components/QuadScreen';
import { ResultScreen } from './components/ResultScreen';
import { AlertCircle } from 'lucide-react';

function App() {
  const { 
    phase,
    error,
    currentQuestion,
    currentQuad,
    currentDuel,
    winner,
    answerQuestion,
    resolveQuad,
    resolveDuel,
    restart 
  } = useGameEngine();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-700 mb-2">Oops! Something Went Wrong.</h2>
        <p className="text-red-600 mb-6">{error}</p>
        <button 
          onClick={restart}
          className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {phase === 'loading' && <LoadingScreen />}

      {phase === 'narrowing' && currentQuestion && (
        <QuestionScreen 
          question={currentQuestion} 
          onAnswer={answerQuestion} 
        />
      )}

      {phase === 'duel' && currentDuel && (
        <DuelScreen 
          pair={currentDuel} 
          onSelect={resolveDuel} 
        />
      )}

      {phase === 'duel' && currentQuad && (
        <QuadScreen
          dishes={currentQuad}
          onSelect={resolveQuad}
        />
      )}

      {phase === 'result' && winner && (
        <ResultScreen 
          winner={winner} 
          onRestart={restart} 
        />
      )}
    </div>
  );
}

export default App;
