'use client';
import { useEffect, useRef, useState } from 'react';

type Position = { x: number; y: number };

const GRID_SIZE = 20;
const GAME_SPEED = 300; // 初始速度调低一倍

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<{ x: 1, y: 0 } | { x: -1, y: 0 } | { x: 0, y: 1 } | { x: 0, y: -1 }>({ x: 1, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
        case ' ':
          setIsPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction]);

  useEffect(() => {
    if (gameOver || isPaused) return;

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        const newSnake = [...prevSnake];
        const head = { ...newSnake[0] };
        
        head.x += direction.x;
        head.y += direction.y;

        // 边界检测
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          return prevSnake;
        }

        // 自我碰撞检测
        if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return prevSnake;
        }

        newSnake.unshift(head);

        // 食物检测
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 1);
          setFood({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
          });
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, GAME_SPEED);

    return () => clearInterval(gameLoop);
  }, [direction, food, gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    const cellSize = Math.min(window.innerWidth * 0.8 / GRID_SIZE, 30);
    canvas.width = GRID_SIZE * cellSize;
    canvas.height = GRID_SIZE * cellSize;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制食物
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(food.x * cellSize, food.y * cellSize, cellSize - 1, cellSize - 1);

    // 绘制蛇
    ctx.fillStyle = '#4CAF50';
    snake.forEach((segment, index) => {
      const alpha = 1 - index * 0.1;
      ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
      ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize - 1, cellSize - 1);
    });

  }, [snake, food]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="mb-4 text-2xl font-bold text-gray-800">得分: {score}</div>
      <div className="mb-4 text-gray-600 text-sm">
        <p>操作说明：</p>
        <ul className="list-disc list-inside">
          <li>方向键 ←↑→↓ 控制移动</li>
          <li>空格键 暂停/继续</li>
          <li>吃到红色食物得分+1</li>
          <li>撞墙或自身游戏结束</li>
        </ul>
      </div>
      <canvas
        ref={canvasRef}
        className="bg-white rounded-lg shadow-lg"
        style={{ border: '2px solid #4CAF50' }}
      />
      <div className="mt-4 space-y-2 text-center">
        {isPaused && (
          <div className="text-blue-600 text-lg">游戏暂停中（按空格键继续）</div>
        )}
        {gameOver ? (
          <>
            <div className="text-red-600 text-xl font-bold">游戏结束！</div>
            <button
              onClick={() => {
                setSnake([{ x: 10, y: 10 }]);
                setFood({ x: 15, y: 15 });
                setDirection({ x: 1, y: 0 });
                setGameOver(false);
                setScore(0);
                setIsPaused(false);
              }}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              重新开始
            </button>
          </>
        ) : (
          <div className="text-gray-500 text-sm">按空格键暂停/继续</div>
        )}
      </div>
    </div>
  );
}
