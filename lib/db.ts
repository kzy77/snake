import { Pool } from 'pg';

// 检查环境变量是否存在
if (!process.env.POSTGRES_URL) {
  throw new Error('Missing POSTGRES_URL environment variable');
}

// 创建数据库连接池
// Next.js 在开发模式下可能会多次加载模块，
// 使用全局变量确保只创建一个连接池实例。
// 参考: https://vercel.com/guides/nextjs-prisma-postgres#step-4.-connect-and-query-your-database
declare global {
  // eslint-disable-next-line no-var
  var pool: Pool | undefined;
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    // 可以在这里添加 SSL 配置等生产环境设置
    // ssl: {
    //   rejectUnauthorized: false, // 根据你的数据库配置调整
    // },
  });
} else {
  // 在开发环境中，将连接池存储在全局变量中，以避免热重载时创建多个连接池
  if (!global.pool) {
    console.log('Creating new database connection pool (development)');
    global.pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    });
  } else {
    console.log('Reusing existing database connection pool (development)');
  }
  pool = global.pool;
}

// 导出一个函数用于执行查询
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), error });
    throw error; // 重新抛出错误，以便 API 路由可以捕获它
  }
};

// 可选：导出一个函数用于获取客户端连接（用于事务等）
// export const getClient = async () => {
//   const client = await pool.connect();
//   return client;
// };

// 导出默认的 pool 实例，如果需要直接访问 Pool API
export default pool;