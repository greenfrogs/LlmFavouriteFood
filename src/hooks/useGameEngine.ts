import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dish, GameState, Question } from '../types';
import { fetchDishes } from '../services/wikidata';
import { generateQuestion } from '../utils/gameLogic';

const POOL_SIZE_FOR_DUEL = 8; 
const QUESTION_TYPE_PREFIX = 'multi-';
const TOURNAMENT_ENTRY_CAP = 34;
const QUAD_MIN_POOL_SIZE = 4;

const questionTypeFromId = (questionId: string): string | null => {
  if (!questionId.startsWith(QUESTION_TYPE_PREFIX)) return null;
  const parts = questionId.split('-');
  return parts.length >= 3 ? parts[1] : null;
};

const normalizeQuestionOption = (value: string): string => value.trim().toLowerCase();

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const useGameEngine = () => {
  const [pool, setPool] = useState<Dish[]>([]);
  const [phase, setPhase] = useState<GameState['phase']>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [winner, setWinner] = useState<Dish | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [currentRoundQueue, setCurrentRoundQueue] = useState<Dish[]>([]);
  const [nextRoundQueue, setNextRoundQueue] = useState<Dish[]>([]);
  const applyTournamentProgress = useCallback((remainingCurrent: Dish[], updatedNextRound: Dish[]) => {
    if (remainingCurrent.length > 1) {
      setCurrentRoundQueue(remainingCurrent);
      setNextRoundQueue(updatedNextRound);
      setPool([...remainingCurrent, ...updatedNextRound]);
      return;
    }

    const nextWithBye =
      remainingCurrent.length === 1 ? [...updatedNextRound, remainingCurrent[0]] : updatedNextRound;

    if (nextWithBye.length === 1) {
      setWinner(nextWithBye[0]);
      setPool(nextWithBye);
      setCurrentRoundQueue([]);
      setNextRoundQueue([]);
      setCurrentQuestion(null);
      setPhase('result');
      return;
    }

    setCurrentRoundQueue(nextWithBye);
    setNextRoundQueue([]);
    setPool(nextWithBye);
  }, []);

  const askedQuestionIdsRef = useRef<Set<string>>(new Set());
  const lastOptionsByQuestionTypeRef = useRef<Map<string, Set<string>>>(new Map());

  const startTournament = useCallback((contenders: Dish[]) => {
    const seededContenders =
      contenders.length > TOURNAMENT_ENTRY_CAP
        ? shuffle(contenders).slice(0, TOURNAMENT_ENTRY_CAP)
        : contenders;

    setCurrentQuestion(null);

    if (seededContenders.length === 0) {
      setError('No Dishes Available For Duels.');
      return;
    }

    if (seededContenders.length === 1) {
      setPool(seededContenders);
      setWinner(seededContenders[0]);
      setCurrentRoundQueue([]);
      setNextRoundQueue([]);
      setPhase('result');
      return;
    }

    setPool(seededContenders);
    setCurrentRoundQueue(seededContenders);
    setNextRoundQueue([]);
    setPhase('duel');
  }, []);

  const prepareNarrowingPhase = useCallback((nextPool: Dish[]) => {
    if (nextPool.length <= POOL_SIZE_FOR_DUEL) {
      startTournament(nextPool);
      return;
    }

    const nextQuestion = generateQuestion(
      nextPool,
      askedQuestionIdsRef.current,
      lastOptionsByQuestionTypeRef.current
    );

    if (!nextQuestion) {
      startTournament(nextPool);
      return;
    }

    askedQuestionIdsRef.current.add(nextQuestion.id);
    const questionType = questionTypeFromId(nextQuestion.id);
    if (questionType) {
      lastOptionsByQuestionTypeRef.current.set(
        questionType,
        new Set(nextQuestion.options.map(normalizeQuestionOption))
      );
    }
    setCurrentRoundQueue([]);
    setNextRoundQueue([]);
    setPhase('narrowing');
    setCurrentQuestion(nextQuestion);
  }, [startTournament]);

  // Initialize
  const init = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setPool([]);
    setWinner(undefined);
    setCurrentQuestion(null);
    setCurrentRoundQueue([]);
    setNextRoundQueue([]);
    askedQuestionIdsRef.current.clear();
    lastOptionsByQuestionTypeRef.current.clear();
    
    try {
      const dishes = await fetchDishes();
      if (dishes.length === 0) {
        setError('No Dishes Found. Please Try Again.');
        return;
      }
      setPool(dishes);
      prepareNarrowingPhase(dishes);
    } catch (e) {
      setError('Failed To Load Dishes.');
      console.error(e);
    }
  }, [prepareNarrowingPhase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void init();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [init]);

  const answerQuestion = useCallback((answer: string) => {
    if (!currentQuestion) return;
    
    // Determine the subset to KEEP
    // The filter function returns true for dishes that MATCH the answer
    // e.g. "Yes" to "Sweet?" -> filter returns true for sweet dishes.
    const newPool = pool.filter(dish => currentQuestion.filter(dish, answer));
    
    if (newPool.length === 0) {
       // Edge case: User filtered everything out?
       // Should ideally not happen if question logic guarantees options exist in pool.
       // But if it does, keep original pool and maybe skip question?
       console.warn("Filter resulted in empty pool, ignoring.");
       setCurrentQuestion(null); 
       return;
    }

    setPool(newPool);
    prepareNarrowingPhase(newPool);
  }, [pool, currentQuestion, prepareNarrowingPhase]);

  const resolveDuel = useCallback((winningDish: Dish) => {
    if (phase !== 'duel' || currentRoundQueue.length < 2) return;

    const [dishA, dishB, ...remaining] = currentRoundQueue;
    const winnerFromPair =
      winningDish.id === dishA.id || winningDish.id === dishB.id ? winningDish : dishA;
    applyTournamentProgress(remaining, [...nextRoundQueue, winnerFromPair]);
  }, [phase, currentRoundQueue, nextRoundQueue, applyTournamentProgress]);

  const resolveQuad = useCallback((winningDish: Dish) => {
    if (phase !== 'duel' || currentRoundQueue.length < 4) return;

    const [dishA, dishB, dishC, dishD, ...remaining] = currentRoundQueue;
    const frontFour = [dishA, dishB, dishC, dishD];
    const winnerFromQuad = frontFour.some((dish) => dish.id === winningDish.id) ? winningDish : dishA;
    applyTournamentProgress(remaining, [...nextRoundQueue, winnerFromQuad]);
  }, [phase, currentRoundQueue, nextRoundQueue, applyTournamentProgress]);

  const currentQuad: [Dish, Dish, Dish, Dish] | null =
    phase === 'duel' && currentRoundQueue.length >= QUAD_MIN_POOL_SIZE
      ? [currentRoundQueue[0], currentRoundQueue[1], currentRoundQueue[2], currentRoundQueue[3]]
      : null;

  const currentDuel: [Dish, Dish] | null = 
    phase === 'duel' && currentRoundQueue.length >= 2 && currentRoundQueue.length < QUAD_MIN_POOL_SIZE
      ? [currentRoundQueue[0], currentRoundQueue[1]]
      : null;

  return {
    pool,
    phase,
    currentQuestion,
    currentQuad,
    currentDuel,
    winner,
    error,
    answerQuestion,
    resolveQuad,
    resolveDuel,
    restart: init
  };
};
