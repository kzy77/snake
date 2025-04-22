import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // 使用我们创建的数据库模块

// 获取高分榜 (Top 10)
export async function GET() {
  try {
    const result = await query(
      `SELECT player_name, score 
       FROM snake_scores 
       ORDER BY score DESC 
       LIMIT 10`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('API GET /api/high-scores Error:', error);
    // 错误已在 query 函数中记录，这里返回通用错误信息
    return NextResponse.json(
      { error: '获取高分记录失败' },
      { status: 500 }
    );
  }
}

// 保存新的分数
export async function POST(request: Request) {
  try {
    const { player_name, score } = await request.json();

    // 基本验证
    if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0 || player_name.length > 50) {
      return NextResponse.json({ error: '无效的玩家名称' }, { status: 400 });
    }
    if (score === undefined || typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
      return NextResponse.json({ error: '无效的分数' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO snake_scores (player_name, score) VALUES ($1, $2) RETURNING id',
      [player_name.trim(), score]
    );

    if (result.rowCount === 1) {
      return NextResponse.json({ message: '分数保存成功', id: result.rows[0].id }, { status: 201 }); // 201 Created
    } else {
      // 理论上，如果 query 没有抛出错误，rowCount 应该是 1
      console.error('API POST /api/high-scores Error: Insert failed unexpectedly', result);
      return NextResponse.json({ error: '保存分数失败' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API POST /api/high-scores Error:', error);
     // 检查是否是 JSON 解析错误
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
    }
    // 检查是否是数据库约束错误等 (可以根据 error.code 细化)
    // 例如：唯一约束 P0001, 非空约束 23502, 检查约束 23514
    // if (error.code === '23505') { // 假设有唯一约束
    //   return NextResponse.json({ error: '记录已存在' }, { status: 409 }); // Conflict
    // }
    return NextResponse.json({ error: '保存分数时发生错误' }, { status: 500 });
  }
}
