# 🍳 干饭厨子

> 家庭点菜软件，让每一顿饭都充满期待

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com/)

<img src="doc/logo.jpg" width="120" height="120" style="border-radius: 24px;">

## ✨ 功能特性

### 🍽️ 双角色系统
- **厨子（管理员）**：上架菜品、管理饭局、设置点菜截止时间、管理家庭成员
- **干饭人（普通用户）**：浏览菜品、参与点菜、评价饭局

### 📱 简洁的交互体验
- 6位数字密码登录，安全便捷
- 首次使用引导，轻松上手
- 青菜绿主题，清新自然

### 🥘 菜品管理
- 本地图片上传，自动压缩至 256KB
- Base64 存储，无需额外图床
- 上架/下架状态切换

### 🍻 饭局系统
- 创建饭局，设置用餐时间
- 点菜截止时间控制
- 实时显示"谁点了什么"
- 用餐后评分评价

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm / yarn / pnpm

### 安装依赖

```bash
npm install
```

### 配置 Supabase

1. **创建 Supabase 项目**
   - 访问 [supabase.com](https://supabase.com) 创建免费账户
   - 新建项目，记录项目 URL 和 Anon Key

2. **配置环境变量**
   ```bash
   cp .env.example .env.local
   ```
   
   编辑 `.env.local`：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **初始化数据库**
   
   进入 Supabase Dashboard → SQL Editor，执行：
   
   ```sql
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

   -- 禁用RLS（简化家庭使用场景）
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ALTER TABLE dishes DISABLE ROW LEVEL SECURITY;
   ALTER TABLE dinners DISABLE ROW LEVEL SECURITY;
   ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
   ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
   ```

### 🔄 重置数据库

如果需要清空所有数据重新开始，在 Supabase Dashboard → SQL Editor 执行：

```sql
-- 重置数据库：删除所有数据但保留表结构
-- 注意：此操作不可逆，请谨慎使用！

-- 删除所有数据（按照外键依赖顺序）
DELETE FROM reviews;
DELETE FROM orders;
DELETE FROM dinners;
DELETE FROM dishes;
DELETE FROM users;

-- 重置序列（如果有自增ID）
-- 注意：UUID 类型不需要重置序列

-- 可选：删除表结构（完全重置）
-- 警告：这将删除所有表，需要重新初始化！
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS dinners CASCADE;
-- DROP TABLE IF EXISTS dishes CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
```

> ⚠️ **警告**：重置操作会删除所有数据，包括：
> - 所有用户信息（包括厨子账号）
> - 所有菜品数据
> - 所有饭局记录
> - 所有点菜记录
> - 所有评价数据
>
> 重置后首次访问系统时，需要重新创建厨子账号。

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 🏗️ 部署到 Vercel

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/mycook)

### 手动部署

1. **推送代码到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/mycook.git
   git push -u origin main
   ```

2. **在 Vercel 导入项目**
   - 登录 [vercel.com](https://vercel.com)
   - 点击 "Add New Project"
   - 导入 GitHub 仓库

3. **配置环境变量**
   - 添加 `NEXT_PUBLIC_SUPABASE_URL`
   - 添加 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **部署**
   - 点击 Deploy，等待构建完成

## 📁 项目结构

```
mycook/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页
│   ├── dishes/            # 菜品列表
│   ├── dinners/           # 饭局列表
│   ├── profile/           # 厨子后台
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── auth/             # 认证相关
│   └── ui/               # shadcn/ui 组件
├── lib/                   # 工具函数
│   ├── supabase.ts       # Supabase 客户端
│   ├── auth.ts           # 认证逻辑
│   └── utils.ts          # 通用工具
├── supabase/
│   └── schema.sql        # 数据库结构
├── public/
│   └── logo.jpg          # 应用图标
└── README.md
```

## 🎨 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [TailwindCSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **数据库**: [Supabase](https://supabase.com/) (PostgreSQL)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **图标**: [Lucide React](https://lucide.dev/)

## 🔒 安全说明

- 密码使用 bcrypt 加密存储
- JWT Token 本地存储，30天有效期
- 图片压缩后 Base64 存储，无需外部图床
- 家庭使用场景，RLS 已禁用简化开发

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE)

---

Made with ❤️ for family dinners
