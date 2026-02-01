import bcrypt from 'bcryptjs'
import { supabase } from './supabase'
import type { User } from './supabase'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(user: User): string {
  const token = JSON.stringify({
    id: user.id,
    nickname: user.nickname,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天过期
  })
  return btoa(token)
}

export function verifyToken(token: string): { id: string; nickname: string; role: 'chef' | 'diner' } | null {
  try {
    const decoded = JSON.parse(atob(token))
    if (decoded.exp < Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

export async function loginUser(nickname: string, password: string): Promise<{ user: User; token: string } | null> {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('nickname', nickname)
    .single()

  if (!user) return null

  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null

  const token = generateToken(user)
  return { user, token }
}

export async function createUser(
  nickname: string,
  role: 'chef' | 'diner',
  password?: string
): Promise<User | null> {
  const passwordHash = password ? await hashPassword(password) : ''

  const { data: user } = await supabase
    .from('users')
    .insert({
      nickname,
      role,
      password_hash: passwordHash,
      is_first_login: !password,
    })
    .select()
    .single()

  return user
}

export async function setPassword(userId: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      is_first_login: false,
    })
    .eq('id', userId)

  return !error
}
