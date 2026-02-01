'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LoginDialog } from '@/components/auth/login-dialog'
import { verifyToken } from '@/lib/auth'
import type { User } from '@/lib/supabase'
import { ChefHat, UtensilsCrossed, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const decoded = verifyToken(token)
      if (decoded) {
        setUser(decoded as User)
      } else {
        localStorage.removeItem('token')
      }
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const navigateTo = (path: string) => {
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="干饭厨子"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </div>
          <h1 className="text-xl font-bold text-foreground">干饭厨子</h1>
        </div>
        
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.nickname}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              退出
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
            登录
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="干饭厨子"
              width={80}
              height={80}
              className="rounded-2xl"
            />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            今天想吃点什么？
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            轻松点菜，美味共享。让每一顿饭都充满期待。
          </p>
        </motion.div>

        {user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-sm space-y-4"
          >
            <Button
              size="lg"
              className="w-full h-16 rounded-2xl text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={() => navigateTo('/dinners')}
            >
              <UtensilsCrossed className="w-5 h-5 mr-2" />
              查看饭局
              <ArrowRight className="w-5 h-5 ml-auto" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="w-full h-16 rounded-2xl text-lg"
              onClick={() => navigateTo('/dishes')}
            >
              <ChefHat className="w-5 h-5 mr-2" />
              浏览菜品
              <ArrowRight className="w-5 h-5 ml-auto" />
            </Button>

            {user.role === 'chef' && (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-16 rounded-2xl text-lg border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => navigateTo('/profile')}
              >
                <ChefHat className="w-5 h-5 mr-2" />
                厨子后台
                <ArrowRight className="w-5 h-5 ml-auto" />
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button
              size="lg"
              className="h-14 px-8 rounded-full text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={() => setLoginOpen(true)}
            >
              开始使用
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-sm text-muted-foreground">
        <p>家庭点菜软件 · 让美食更简单</p>
      </footer>

      {/* Login Dialog */}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLogin={handleLogin} />
    </div>
  )
}
