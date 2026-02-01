import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// 数据库类型定义
export type User = {
  id: string
  nickname: string
  password_hash: string
  role: 'chef' | 'diner'
  is_first_login: boolean
  created_at: string
}

export type Dish = {
  id: string
  title: string
  description: string | null
  images: string[]
  status: 'active' | 'inactive'
  created_by: string
  created_at: string
}

export type Dinner = {
  id: string
  title: string
  dining_time: string
  order_deadline: string
  allow_modify: boolean
  created_by: string
  created_at: string
  status: 'active' | 'completed' | 'cancelled'
}

export type Order = {
  id: string
  dinner_id: string
  dish_id: string
  user_id: string
  created_at: string
}

export type Review = {
  id: string
  dinner_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
}

// 带用户信息的扩展类型
export type OrderWithUser = Order & {
  user: Pick<User, 'id' | 'nickname'>
}

export type DinnerWithOrders = Dinner & {
  orders: OrderWithUser[]
  reviews: (Review & { user: Pick<User, 'id' | 'nickname'> })[]
}
