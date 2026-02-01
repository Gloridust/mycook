-- 干饭厨子数据库结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('chef', 'diner')),
  is_first_login BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 饭局表
CREATE TABLE IF NOT EXISTS dinners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  dining_time TIMESTAMP WITH TIME ZONE NOT NULL,
  order_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  allow_modify BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- 点菜记录表
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dinner_id UUID NOT NULL REFERENCES dinners(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dinner_id, dish_id, user_id)
);

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dinner_id UUID NOT NULL REFERENCES dinners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dinner_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dishes_status ON dishes(status);
CREATE INDEX IF NOT EXISTS idx_dishes_created_by ON dishes(created_by);
CREATE INDEX IF NOT EXISTS idx_dinners_status ON dinners(status);
CREATE INDEX IF NOT EXISTS idx_dinners_created_by ON dinners(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_dinner_id ON orders(dinner_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_dinner_id ON reviews(dinner_id);

-- 禁用RLS（简化开发，生产环境建议开启）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE dishes DISABLE ROW LEVEL SECURITY;
ALTER TABLE dinners DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

-- 如果需要开启RLS，使用以下策略（需要配合认证）
/*
-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinners ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "允许所有人读取用户" ON users;
DROP POLICY IF EXISTS "允许所有人创建用户" ON users;
DROP POLICY IF EXISTS "允许厨子创建用户" ON users;
DROP POLICY IF EXISTS "允许所有人读取菜品" ON dishes;
DROP POLICY IF EXISTS "允许厨子管理菜品" ON dishes;
DROP POLICY IF EXISTS "允许所有人读取饭局" ON dinners;
DROP POLICY IF EXISTS "允许所有人创建饭局" ON dinners;
DROP POLICY IF EXISTS "允许创建者或厨子修改饭局" ON dinners;
DROP POLICY IF EXISTS "允许厨子删除饭局" ON dinners;
DROP POLICY IF EXISTS "允许所有人读取点菜" ON orders;
DROP POLICY IF EXISTS "允许认证用户点菜" ON orders;
DROP POLICY IF EXISTS "允许用户取消自己的点菜" ON orders;
DROP POLICY IF EXISTS "允许所有人读取评价" ON reviews;
DROP POLICY IF EXISTS "允许认证用户创建评价" ON reviews;
DROP POLICY IF EXISTS "允许用户修改自己的评价" ON reviews;

-- RLS策略：用户表
CREATE POLICY "允许所有人读取用户" ON users FOR SELECT USING (true);
CREATE POLICY "允许所有人创建用户" ON users FOR INSERT WITH CHECK (true);

-- RLS策略：菜品表
CREATE POLICY "允许所有人读取菜品" ON dishes FOR SELECT USING (true);
CREATE POLICY "允许所有人管理菜品" ON dishes FOR ALL USING (true);

-- RLS策略：饭局表
CREATE POLICY "允许所有人读取饭局" ON dinners FOR SELECT USING (true);
CREATE POLICY "允许所有人创建饭局" ON dinners FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人修改饭局" ON dinners FOR UPDATE USING (true);
CREATE POLICY "允许所有人删除饭局" ON dinners FOR DELETE USING (true);

-- RLS策略：点菜表
CREATE POLICY "允许所有人读取点菜" ON orders FOR SELECT USING (true);
CREATE POLICY "允许所有人点菜" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人取消点菜" ON orders FOR DELETE USING (true);

-- RLS策略：评价表
CREATE POLICY "允许所有人读取评价" ON reviews FOR SELECT USING (true);
CREATE POLICY "允许所有人创建评价" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人修改评价" ON reviews FOR UPDATE USING (true);
*/
