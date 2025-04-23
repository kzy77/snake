'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

type Position = { x: number; y: number };
type HighScore = { player_name: string; score: number };

const GRID_SIZE = 20;
const CELL_SIZE = 25; // 固定格子大小
const GAME_SPEED_MS = 150; // 游戏速度 (毫秒)

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(true);
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<{ x: number; y: number }>({ x: 1, y: 0 });
  // 用于防止快速反向移动
  const directionRef = useRef(direction);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 获取高分记录
  const fetchHighScores = useCallback(async () => {
    setFetchError(null);
    try {
      const response = await fetch('/api/high-scores');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // 尝试解析错误信息
        throw new Error(errorData.error || `获取高分失败: ${response.statusText}`);
      }
      const data: HighScore[] = await response.json();
      setHighScores(data);
    } catch (error: any) {
      console.error('获取高分记录失败:', error);
      setFetchError(error.message || '无法连接到服务器');
    }
  }, []);

  // 保存分数到数据库
  const saveScore = useCallback(async () => {
    if (!playerName || score <= 0 || isSaving) return; // 不保存0分或正在保存中

    setIsSaving(true);
    setSaveError(null);
    console.log(`尝试保存分数: ${playerName} - ${score}`);

    try {
      const response = await fetch('/api/high-scores', { // <--- 更新 API 端点
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_name: playerName, // <--- 确保字段名与 API 匹配
          score: score
        }),
      });

      const responseData = await response.json().catch(() => ({})); // 尝试解析响应

      if (!response.ok) {
        throw new Error(responseData.error || `保存失败: ${response.statusText}`);
      }

      console.log('分数保存成功:', responseData);
      // alert('分数保存成功!'); // 可以用更友好的方式提示
      await fetchHighScores(); // 保存成功后刷新高分榜

    } catch (error: any) {
      console.error('保存分数出错:', error);
      setSaveError(error.message || '保存分数时发生未知错误');
      // alert(`保存分数失败: ${error.message}`); // 提示用户
    } finally {
      setIsSaving(false);
    }
  }, [playerName, score, fetchHighScores, isSaving]);


  // 初始加载高分榜
  useEffect(() => {
    fetchHighScores();
  }, [fetchHighScores]);

  // 游戏结束时自动保存分数
  useEffect(() => {
    if (gameOver && !isSaving) {
      saveScore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]); // 依赖 gameOver, saveScore 在 useCallback 中定义，其依赖已包含

  // 处理键盘输入
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      let newDirection = directionRef.current; // 使用 ref 防止闭包问题

      switch (e.key) {
        case 'ArrowUp':
          if (directionRef.current.y === 0) newDirection = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
          if (directionRef.current.y === 0) newDirection = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
          if (directionRef.current.x === 0) newDirection = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
          if (directionRef.current.x === 0) newDirection = { x: 1, y: 0 };
          break;
        case ' ': // 空格键
        case 'p': // P键暂停
          // 游戏进行中或已暂停时才响应暂停键
          if (!gameOver && !showNameInput) {
             e.preventDefault(); // 防止空格键滚动页面
             setIsPaused(prev => !prev);
          }
          return; // 暂停/继续不改变方向
        default:
          return; // 忽略其他按键
      }

      // 更新方向 state 和 ref
      setDirection(newDirection);
      directionRef.current = newDirection;
    };

    window.addEventListener('keydown', handleKeyPress);
    // 添加鼠标和触摸事件监听器
    canvasRef.current?.addEventListener('mousedown', handleMouseDown);
    canvasRef.current?.addEventListener('mouseup', handleMouseUp);
    canvasRef.current?.addEventListener('touchstart', handleTouchStart);
    canvasRef.current?.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      canvasRef.current?.removeEventListener('mousedown', handleMouseDown);
      canvasRef.current?.removeEventListener('mouseup', handleMouseUp);
      canvasRef.current?.removeEventListener('touchstart', handleTouchStart);
      canvasRef.current?.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameOver, showNameInput]); // 依赖 gameOver 和 showNameInput 以控制暂停键的有效性

  // 游戏主循环
  useEffect(() => {
    if (gameOver || isPaused || showNameInput) return; // 游戏结束、暂停或等待输入名字时不运行

    const gameLoop = setInterval(() => {
      setSnake(prevSnake => {
        const newSnake = [...prevSnake];
        const head = { ...newSnake[0] };

        // 使用最新的方向 state
        head.x += direction.x;
        head.y += direction.y;

        // 边界检测 (循环到另一边)
        // head.x = (head.x + GRID_SIZE) % GRID_SIZE;
        // head.y = (head.y + GRID_SIZE) % GRID_SIZE;

        // 边界检测 (撞墙结束)
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          clearInterval(gameLoop); // 清除定时器
          return prevSnake;
        }

        // 自我碰撞检测 (检查新头位置是否在蛇身段，不包括尾巴，因为尾巴会移开)
        // 注意：如果蛇只有一个头，some 会返回 false
        if (newSnake.length > 1 && newSnake.slice(0, -1).some(segment => segment.x === head.x && segment.y === head.y)) {
           setGameOver(true);
           clearInterval(gameLoop); // 清除定时器
           return prevSnake;
        }


        newSnake.unshift(head); // 将新头添加到蛇的前面

        // 食物检测
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 1);
          // 生成新食物，确保不在蛇身上
          let newFoodPosition: Position;
          do {
            newFoodPosition = {
              x: Math.floor(Math.random() * GRID_SIZE),
              y: Math.floor(Math.random() * GRID_SIZE)
            };
          } while (newSnake.some(segment => segment.x === newFoodPosition.x && segment.y === newFoodPosition.y));
          setFood(newFoodPosition);
        } else {
          newSnake.pop(); // 没有吃到食物，移除蛇尾
        }

        return newSnake;
      });
    }, GAME_SPEED_MS);

    // 清理函数：当依赖项变化或组件卸载时清除定时器
    return () => clearInterval(gameLoop);

  }, [direction, food, gameOver, isPaused, showNameInput]); // 依赖项包括暂停和名字输入状态

  // 绘制游戏画面
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置固定画布尺寸
    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    // 清空画布
    ctx.fillStyle = '#f0f0f0'; // 背景色
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格线 (可选)
    // ctx.strokeStyle = '#ddd';
    // for (let i = 0; i <= GRID_SIZE; i++) {
    //   ctx.beginPath();
    //   ctx.moveTo(i * CELL_SIZE, 0);
    //   ctx.lineTo(i * CELL_SIZE, canvas.height);
    //   ctx.stroke();
    //   ctx.beginPath();
    //   ctx.moveTo(0, i * CELL_SIZE);
    //   ctx.lineTo(canvas.width, i * CELL_SIZE);
    //   ctx.stroke();
    // }


    // 绘制食物
    ctx.fillStyle = '#ef4444'; // 红色
    ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    // 添加一点样式
    ctx.fillStyle = '#dc2626'; // 深红
    ctx.fillRect(food.x * CELL_SIZE + CELL_SIZE * 0.1, food.y * CELL_SIZE + CELL_SIZE * 0.1, CELL_SIZE * 0.8, CELL_SIZE * 0.8);


    // 绘制蛇
    snake.forEach((segment, index) => {
      // 蛇头用不同颜色
      ctx.fillStyle = index === 0 ? '#16a34a' : '#22c55e'; // 深绿头，亮绿身
      ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      // 添加边框效果
      ctx.strokeStyle = '#15803d'; // 更深的绿色边框
      ctx.lineWidth = 1;
      ctx.strokeRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

  }, [snake, food]); // 依赖蛇和食物的位置

  // 重置游戏状态
  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    const initialDirection = { x: 1, y: 0 };
    setDirection(initialDirection);
    directionRef.current = initialDirection; // 重置 ref
    setGameOver(false);
    setScore(0);
    setIsPaused(false);
    setIsSaving(false);
    setSaveError(null);
    // 不重置 playerName 和 showNameInput，允许玩家用同一名字再玩
    // 如果需要每次都输入名字，取消下一行的注释
    // setShowNameInput(true);
    // 重新获取高分榜，以防在游戏结束界面停留时有更新
    fetchHighScores();
  };

  // 处理开始游戏按钮点击
  const handleStartGame = () => {
    if (playerName.trim()) {
      setShowNameInput(false);
      // 重置游戏状态以防万一（例如，如果玩家在输入名字时刷新了页面）
      resetGame();
      // 确保游戏不是暂停状态
      setIsPaused(false);
    }
  };

  // 鼠标释放事件处理函数
  const handleMouseUp = (e: MouseEvent) => {
    // 鼠标释放时，不改变方向
  };

  // 触摸开始事件处理函数
  const handleTouchStart = (e: TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);

    updateDirection(gridX, gridY);
  };

  // 触摸结束事件处理函数
  const handleTouchEnd = (e: TouchEvent) => {
    // 触摸结束时，不改变方向
  };

  const updateDirection = (gridX: number, gridY: number) => {
    const head = snake[0];

    let newDirection = directionRef.current;

    if (gridX < head.x && directionRef.current.x === 0) {
      newDirection = { x: -1, y: 0 };
    } else if (gridX > head.x && directionRef.current.x === 0) {
      newDirection = { x: 1, y: 0 };
    } else if (gridY < head.y && directionRef.current.y === 0) {
      newDirection = { x: 0, y: 1 };
    } else if (gridY > head.y && directionRef.current.y === 0) {
      newDirection = { x: 0, y: -1 };
    }

    setDirection(newDirection);
    directionRef.current = newDirection;
  };

  // 鼠标按下事件处理函数
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let startX = e.clientX - rect.left;
    let startY = e.clientY - rect.top;

    const handleMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      let newDirection = directionRef.current;

      // 减少方向改变的阈值
      const threshold = 5;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        // 水平滑动
        if (deltaX > 0 && directionRef.current.x === 0) {
          newDirection = { x: 1, y: 0 }; // 向右
        } else if (deltaX < 0 && directionRef.current.x === 0) {
          newDirection = { x: -1, y: 0 }; // 向左
        }
      } else if (Math.abs(deltaY) > threshold) {
        // 垂直滑动
        if (deltaY > 0 && directionRef.current.y === 0) {
          newDirection = { x: 0, y: 1 }; // 向下
        } else if (deltaY < 0 && directionRef.current.y === 0) {
          newDirection = { x: 0, y: -1 }; // 向上
        }
      }

      setDirection(newDirection);
      directionRef.current = newDirection;

      startX = currentX;
      startY = currentY;
    };

    const handleMouseUp = () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center min-h-screen bg-gray-800 text-gray-100 p-4 lg:p-8 space-y-4 lg:space-y-0 lg:space-x-8">
      {/* 玩家姓名输入弹窗 */}
      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-700 p-6 rounded-lg shadow-xl space-y-4 w-full max-w-sm">
            <h2 className="text-2xl font-bold text-center text-teal-400">贪吃蛇大作战</h2>
            <p className="text-center text-gray-300">请输入你的玩家名称开始游戏：</p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="border-2 border-gray-500 bg-gray-800 text-gray-100 p-3 w-full rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="玩家名称 (最多50字符)"
              maxLength={50} // 匹配数据库限制
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleStartGame(); }}
            />
            <button
              onClick={handleStartGame}
              className="w-full bg-teal-500 text-gray-900 font-bold px-4 py-3 rounded hover:bg-teal-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
              disabled={!playerName.trim()}
            >
              开始游戏
            </button>
          </div>
        </div>
      )}

      {/* 游戏区域 */}
      <div className="flex flex-col items-center space-y-4">
        <div className="text-3xl font-bold text-yellow-400">得分: {score}</div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="bg-gray-900 rounded-lg shadow-lg border-4 border-teal-600"
            // 宽度和高度在 useEffect 中设置
          />
          {/* 游戏结束或暂停时的遮罩 */}
          {(gameOver || isPaused) && !showNameInput && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center rounded-lg text-center p-4">
              {isPaused && !gameOver && (
                <>
                  <div className="text-3xl font-bold text-blue-400 mb-4">游戏暂停</div>
                  <div className="text-lg text-gray-300">按 空格键 或 P键 继续</div>
                </>
              )}
              {gameOver && (
                <>
                  <div className="text-4xl font-bold text-red-500 mb-4">游戏结束！</div>
                  <div className="text-2xl text-yellow-400 mb-4">最终得分: {score}</div>
                  {isSaving && <div className="text-lg text-blue-400 mb-2">正在保存分数...</div>}
                  {saveError && <div className="text-lg text-red-400 mb-2">保存失败: {saveError}</div>}
                  <button
                    onClick={resetGame}
                    className="mt-4 px-6 py-3 bg-green-500 text-white font-semibold rounded hover:bg-green-600 transition-colors"
                  >
                    重新开始
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="text-gray-400 text-sm text-center max-w-md">
          使用 方向键 ←↑→↓ 控制移动。按 空格键 或 P键 暂停/继续。撞到墙壁或自身即结束游戏。
        </div>
      </div>

      {/* 高分榜区域 */}
      <div className="w-full lg:w-80 bg-gray-700 p-4 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-teal-400 mb-4">🏆 高分榜 🏆</h2>
        {fetchError && (
          <div className="text-red-400 text-center">加载高分榜失败: {fetchError}</div>
        )}
        {!fetchError && highScores.length === 0 && (
          <div className="text-gray-400 text-center">暂无高分记录</div>
        )}
        {!fetchError && highScores.length > 0 && (
          <ul className="space-y-2">
            {highScores.map((hs, index) => (
              <li key={index} className={`flex justify-between items-center p-2 rounded ${index < 3 ? 'bg-gray-600' : 'bg-gray-800'}`}>
                <span className="font-semibold text-lg">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  <span className="ml-2 truncate" title={hs.player_name}>{hs.player_name}</span>
                </span>
                <span className={`font-bold text-xl ${index < 3 ? 'text-yellow-400' : 'text-gray-300'}`}>{hs.score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
