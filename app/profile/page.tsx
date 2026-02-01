'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase, type User } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { 
  ArrowLeft, 
  ChefHat, 
  User as UserIcon,
  Plus,
  Trash2,
  Users,
  LogOut,
  Crown,
  Loader2
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({ nickname: '', role: 'diner' as 'chef' | 'diner' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    
    const decoded = verifyToken(token)
    if (!decoded) {
      localStorage.removeItem('token')
      router.push('/')
      return
    }
    
    setUser(decoded as User)
    
    // 只有厨子能访问此页面
    if (decoded.role !== 'chef') {
      router.push('/')
      return
    }
    
    fetchUsers()
  }, [router, fetchUsers])

  const handleAddUser = async () => {
    if (!newUser.nickname.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('users').insert({
        nickname: newUser.nickname,
        role: newUser.role,
        password_hash: '',
        is_first_login: true,
      })

      if (!error) {
        setAddUserDialogOpen(false)
        setNewUser({ nickname: '', role: 'diner' })
        fetchUsers()
      } else {
        alert('创建失败，昵称可能已存在')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除这个用户吗？')) return

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (!error) {
      fetchUsers()
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">厨子后台</h1>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-4xl mx-auto">
        {/* User Info Card */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-primary">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  <ChefHat className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{user?.nickname}</h2>
                <Badge className="mt-1 bg-primary/20 text-primary hover:bg-primary/30">
                  厨子（管理员）
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="stats">
              <ChefHat className="w-4 h-4 mr-2" />
              统计信息
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">家庭成员</h3>
              <Button size="sm" onClick={() => setAddUserDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                添加用户
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {users.map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className={
                                u.role === 'chef' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              }>
                                {u.role === 'chef' ? (
                                  <ChefHat className="w-5 h-5" />
                                ) : (
                                  <UserIcon className="w-5 h-5" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{u.nickname}</span>
                                {u.role === 'chef' && (
                                  <Badge variant="outline" className="text-primary border-primary">
                                    厨子
                                  </Badge>
                                )}
                                {u.is_first_login && (
                                  <Badge variant="secondary">待设置密码</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                创建于 {new Date(u.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {u.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">{users.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">总用户数</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {users.filter(u => u.role === 'chef').length}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">厨子数</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {users.filter(u => u.is_first_login).length}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">待激活</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {users.filter(u => !u.is_first_login).length}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">已激活</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加新用户</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>昵称</Label>
              <Input
                placeholder="输入用户昵称"
                value={newUser.nickname}
                onChange={(e) => setNewUser(prev => ({ ...prev, nickname: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>角色</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={newUser.role === 'diner' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setNewUser(prev => ({ ...prev, role: 'diner' }))}
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  干饭人
                </Button>
                <Button
                  type="button"
                  variant={newUser.role === 'chef' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setNewUser(prev => ({ ...prev, role: 'chef' }))}
                >
                  <ChefHat className="w-4 h-4 mr-2" />
                  厨子
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              新用户默认无密码，首次登录时需要设置6位数字密码。
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddUserDialogOpen(false)} disabled={isSubmitting}>
              取消
            </Button>
            <Button 
              className="flex-1 bg-primary" 
              onClick={handleAddUser}
              disabled={!newUser.nickname.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 添加中...</>
              ) : (
                '添加用户'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
