import express, { Request, Response } from 'express';
import path from 'path';
import { pool } from './db';

const app = express();
const port: number = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// トップページ（Fetchを用いるTODOアプリ画面）
app.get('/', (_req: Request, res: Response): void => {
  res.render('index');
});

// DB接続確認エンドポイント
app.get('/api/db-check', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT 1 AS connection_test');
    if (result.rows[0]?.connection_test !== 1) {
      res.status(503).json({ status: 'error', database: 'unavailable' });
      return;
    }
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('DB接続確認に失敗しました', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

// [Read] TODO一覧の取得
app.get('/api/todos', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, title, completed, created_at FROM todos ORDER BY id DESC'
    );
    res.json({ todos: result.rows });
  } catch (error) {
    console.error('TODO取得エラー:', error);
    res.status(500).json({ error: 'TODOの取得に失敗しました' });
  }
});

// [Create] TODOの新規作成
app.post('/api/todos', async (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'タイトルを入力してください' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, completed, created_at',
      [title.trim()]
    );
    res.status(201).json({ todo: result.rows[0] });
  } catch (error) {
    console.error('TODO作成エラー:', error);
    res.status(500).json({ error: 'TODOの作成に失敗しました' });
  }
});

// [Update] TODOの完了状態・タイトルの更新
app.patch('/api/todos/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { completed, title } = req.body;

  if (Number.isNaN(id)) {
    res.status(400).json({ error: '無効なIDです' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE todos
       SET completed = COALESCE($1, completed),
           title = COALESCE($2, title)
       WHERE id = $3
       RETURNING id, title, completed, created_at`,
      [
        typeof completed === 'boolean' ? completed : null,
        typeof title === 'string' && title.trim() !== '' ? title.trim() : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: '対象のTODOが見つかりません' });
      return;
    }
    res.json({ todo: result.rows[0] });
  } catch (error) {
    console.error('TODO更新エラー:', error);
    res.status(500).json({ error: 'TODOの更新に失敗しました' });
  }
});

// [Delete] TODOの削除
app.delete('/api/todos/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: '無効なIDです' });
    return;
  }

  try {
    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '対象のTODOが見つかりません' });
      return;
    }
    res.json({ deletedId: id });
  } catch (error) {
    console.error('TODO削除エラー:', error);
    res.status(500).json({ error: 'TODOの削除に失敗しました' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, (): void => {
    console.log(`Server started: http://localhost:${port}`);
  });
}

export default app;