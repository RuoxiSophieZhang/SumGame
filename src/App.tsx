import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Block, GameMode, GameState } from './types';
import { GRID_COLS, GRID_ROWS, INITIAL_ROWS, MAX_VALUE, MIN_VALUE, TARGET_SUMS, TIME_LIMIT } from './constants';
import { BlockComponent } from './components/Block';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Timer, Zap, Play, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createBlock = (row: number, col: number, isNew = false): Block => ({
  id: generateId(),
  value: Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE,
  row,
  col,
  isNew
});

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    grid: [],
    selectedIds: [],
    targetSum: 10,
    score: 0,
    highScore: parseInt(localStorage.getItem('sum-smash-highscore') || '0'),
    isGameOver: false,
    mode: 'classic',
    timeLeft: TIME_LIMIT,
    combo: 0
  });

  const [gameStarted, setGameStarted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const initGame = useCallback((mode: GameMode) => {
    const initialGrid: Block[] = [];
    for (let r = 0; r < INITIAL_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        initialGrid.push(createBlock(GRID_ROWS - 1 - r, c));
      }
    }
    setGameState(prev => ({
      ...prev,
      grid: initialGrid,
      selectedIds: [],
      targetSum: TARGET_SUMS[Math.floor(Math.random() * TARGET_SUMS.length)],
      score: 0,
      isGameOver: false,
      mode,
      timeLeft: TIME_LIMIT,
      combo: 0
    }));
    setHintIds([]);
    setGameStarted(true);
  }, []);

  const addNewRow = useCallback(() => {
    setGameState(prev => {
      const newGrid = [...prev.grid];
      
      // Shift all existing blocks up
      const shiftedGrid = newGrid.map(b => ({ ...b, row: b.row - 1, isNew: false }));
      
      // Check for game over (if any block reaches row 0)
      if (shiftedGrid.some(b => b.row < 0)) {
        return { ...prev, isGameOver: true };
      }

      // Add new row at the bottom
      for (let c = 0; c < GRID_COLS; c++) {
        shiftedGrid.push(createBlock(GRID_ROWS - 1, c, true));
      }

      return { ...prev, grid: shiftedGrid, timeLeft: TIME_LIMIT };
    });
  }, []);

  // Timer logic for Time Mode
  useEffect(() => {
    if (gameStarted && !gameState.isGameOver && gameState.mode === 'time') {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            // Time's up, add row
            return { ...prev, timeLeft: TIME_LIMIT };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameState.isGameOver, gameState.mode]);

  // Watch for timeLeft reaching 0 to add row
  useEffect(() => {
    if (gameState.mode === 'time' && gameState.timeLeft === TIME_LIMIT && gameStarted && !gameState.isGameOver) {
        // This is a bit hacky but works with the interval above
        // We only add row when it resets
    }
  }, [gameState.timeLeft, gameState.mode, gameStarted, gameState.isGameOver]);

  // Separate effect to handle row addition to avoid state update loops
  const lastTimeRef = useRef(TIME_LIMIT);
  useEffect(() => {
    if (gameState.mode === 'time' && gameStarted && !gameState.isGameOver) {
        if (lastTimeRef.current === 1 && gameState.timeLeft === TIME_LIMIT) {
            addNewRow();
        }
        lastTimeRef.current = gameState.timeLeft;
    }
  }, [gameState.timeLeft, gameState.mode, gameStarted, gameState.isGameOver, addNewRow]);

  const findHint = useCallback(() => {
    if (gameState.isGameOver || hintIds.length > 0) return;

    // Simple subset sum search to find a valid combination
    const blocks = [...gameState.grid].sort((a, b) => a.value - b.value);
    const target = gameState.targetSum;
    let foundIds: string[] = [];

    const backtrack = (index: number, currentSum: number, currentIds: string[]): boolean => {
      if (currentSum === target) {
        foundIds = currentIds;
        return true;
      }
      if (currentSum > target || index >= blocks.length) return false;

      // Try including this block
      if (backtrack(index + 1, currentSum + blocks[index].value, [...currentIds, blocks[index].id])) {
        return true;
      }
      // Try excluding this block
      if (backtrack(index + 1, currentSum, currentIds)) {
        return true;
      }
      return false;
    };

    if (backtrack(0, 0, [])) {
      setHintIds(foundIds);
      // Clear hint after 3 seconds
      setTimeout(() => setHintIds([]), 3000);
    } else {
      // If no solution exists, refresh the target
      setGameState(prev => ({
        ...prev,
        targetSum: TARGET_SUMS[Math.floor(Math.random() * TARGET_SUMS.length)],
        selectedIds: []
      }));
    }
  }, [gameState.grid, gameState.targetSum, gameState.isGameOver, hintIds]);

  const handleBlockClick = (id: string) => {
    if (gameState.isGameOver) return;

    setGameState(prev => {
      const isSelected = prev.selectedIds.includes(id);
      const newSelectedIds = isSelected 
        ? prev.selectedIds.filter(sid => sid !== id)
        : [...prev.selectedIds, id];
      
      const selectedBlocks = prev.grid.filter(b => newSelectedIds.includes(b.id));
      const currentSum = selectedBlocks.reduce((sum, b) => sum + b.value, 0);

      if (currentSum === prev.targetSum) {
        // Success!
        const remainingGrid = prev.grid.filter(b => !newSelectedIds.includes(b.id));
        
        // Apply gravity
        const gridAfterGravity = applyGravity(remainingGrid);
        
        const points = prev.targetSum * newSelectedIds.length * (1 + prev.combo * 0.1);
        const newScore = prev.score + Math.floor(points);
        
        if (newScore > prev.highScore) {
          localStorage.setItem('sum-smash-highscore', newScore.toString());
        }

        confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#ec4899', '#f59e0b']
        });

        // Clear hints if any
        setHintIds([]);

        // In classic mode, add a row after success
        if (prev.mode === 'classic') {
          // We'll handle row addition in a timeout or next tick to allow animations
          setTimeout(addNewRow, 400);
        }

        return {
          ...prev,
          grid: gridAfterGravity,
          selectedIds: [],
          score: newScore,
          highScore: Math.max(newScore, prev.highScore),
          targetSum: TARGET_SUMS[Math.floor(Math.random() * TARGET_SUMS.length)],
          combo: prev.combo + 1
        };
      } else if (currentSum > prev.targetSum) {
        // Over sum, reset selection
        return { ...prev, selectedIds: [], combo: 0 };
      }

      return { ...prev, selectedIds: newSelectedIds };
    });
  };

  const applyGravity = (grid: Block[]): Block[] => {
    const newGrid: Block[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const colBlocks = grid.filter(b => b.col === c).sort((a, b) => b.row - a.row);
      colBlocks.forEach((b, index) => {
        newGrid.push({ ...b, row: GRID_ROWS - 1 - index });
      });
    }
    return newGrid;
  };

  const currentSelectedSum = gameState.grid
    .filter(b => gameState.selectedIds.includes(b.id))
    .reduce((sum, b) => sum + b.value, 0);

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-6xl font-display font-extrabold text-slate-900 tracking-tight">
              数字<span className="text-indigo-600">消除</span>
            </h1>
            <p className="text-slate-500 font-medium italic">极简数学求和挑战</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => initGame('classic')}
              className="group relative overflow-hidden bg-white p-6 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 transition-all shadow-sm hover:shadow-xl text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-bold text-slate-800">经典模式</span>
                <Zap className="text-amber-500 group-hover:scale-125 transition-transform" />
              </div>
              <p className="text-sm text-slate-500">每次成功消除后新增一行。挑战生存极限！</p>
            </button>

            <button 
              onClick={() => initGame('time')}
              className="group relative overflow-hidden bg-white p-6 rounded-2xl border-2 border-slate-200 hover:border-rose-500 transition-all shadow-sm hover:shadow-xl text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-bold text-slate-800">计时模式</span>
                <Timer className="text-rose-500 group-hover:scale-125 transition-transform" />
              </div>
              <p className="text-sm text-slate-500">争分夺秒！每隔 {TIME_LIMIT} 秒强制新增一行。</p>
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-medium transition-colors"
            >
              <Info size={18} />
              游戏玩法
            </button>
          </div>

          {gameState.highScore > 0 && (
            <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-sm">
              <Trophy size={14} className="text-amber-500" />
              最高分: {gameState.highScore}
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {showTutorial && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowTutorial(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-2xl font-display font-bold text-slate-900">如何开始？</h2>
                <ul className="space-y-4 text-slate-600">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                    <p>点击数字进行选择，它们不需要相邻。</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                    <p>使选中数字的总和等于顶部的<b>目标数字</b>。</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                    <p>不要让方块堆积到屏幕顶部！</p>
                  </li>
                </ul>
                <button 
                  onClick={() => setShowTutorial(false)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  开始游戏
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">当前得分</span>
            <span className="text-3xl font-display font-extrabold text-slate-900">{gameState.score}</span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">最高纪录</span>
            <div className="flex items-center gap-1 text-slate-600 font-bold">
              <Trophy size={14} className="text-amber-500" />
              {gameState.highScore}
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex flex-col">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">目标数字</span>
              <span className="text-5xl font-display font-black text-indigo-600">{gameState.targetSum}</span>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">当前总和</span>
              <div className={cn(
                "text-3xl font-display font-bold transition-colors",
                currentSelectedSum > gameState.targetSum ? "text-rose-500" : "text-slate-800"
              )}>
                {currentSelectedSum}
              </div>
            </div>
          </div>

          {/* Progress Bar for Time Mode */}
          {gameState.mode === 'time' && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <motion.div 
                initial={false}
                animate={{ width: `${(gameState.timeLeft / TIME_LIMIT) * 100}%` }}
                className={cn(
                  "h-full transition-colors",
                  gameState.timeLeft < 5 ? "bg-rose-500" : "bg-indigo-500"
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-md h-[520px] bg-slate-100 rounded-[2rem] shadow-xl border-4 border-white overflow-hidden p-2">
        <div 
          className="grid gap-1.5 h-full relative z-10"
          style={{ 
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
          }}
        >
          {gameState.grid.length === 0 ? (
            <div className="col-span-6 row-span-10 flex items-center justify-center text-slate-500 font-medium">
              正在初始化方块...
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {gameState.grid.map(block => (
                <motion.div 
                  key={block.id}
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  style={{ 
                    gridRow: block.row + 1, 
                    gridColumn: block.col + 1,
                    position: 'relative',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <BlockComponent 
                    block={block}
                    isSelected={gameState.selectedIds.includes(block.id)}
                    isHinted={hintIds.includes(block.id)}
                    onClick={handleBlockClick}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Debug Info */}
        <div className="absolute bottom-2 right-4 text-[10px] text-slate-400 z-50">
          Blocks: {gameState.grid.length}
        </div>

        {/* Danger Zone Indicator */}
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/20 pointer-events-none" />

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameState.isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-5xl font-display font-black text-white">游戏结束</h2>
                  <p className="text-slate-300 font-medium">方块已经触顶了！</p>
                </div>

                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">最终得分</div>
                  <div className="text-4xl font-display font-bold text-white">{gameState.score}</div>
                </div>

                <button 
                  onClick={() => initGame(gameState.mode)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/30"
                >
                  <RotateCcw size={24} />
                  再试一次
                </button>

                <button 
                  onClick={() => setGameStarted(false)}
                  className="w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-colors"
                >
                  返回主菜单
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-md mt-6 flex items-center justify-between gap-2">
        <button 
          onClick={() => setGameStarted(false)}
          className="p-4 bg-white rounded-2xl text-slate-400 hover:text-slate-600 transition-colors shadow-sm border border-slate-200"
          title="返回菜单"
        >
          <RotateCcw size={20} />
        </button>

        <button 
          onClick={findHint}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-white rounded-2xl text-indigo-600 font-bold shadow-sm border border-slate-200 hover:border-indigo-300 transition-all active:scale-95"
          title="获取提示"
        >
          <Zap size={20} className="text-amber-500" />
          <span>获取提示</span>
        </button>

        <button 
          onClick={() => setShowTutorial(true)}
          className="p-4 bg-white rounded-2xl text-slate-400 hover:text-slate-600 transition-colors shadow-sm border border-slate-200"
          title="玩法说明"
        >
          <Info size={20} />
        </button>
      </div>
    </div>
  );
}
