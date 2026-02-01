'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Numpad } from './numpad'
import { supabase } from '@/lib/supabase'
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth'
import { User } from '@/lib/supabase'
import { ChefHat, User as UserIcon, ArrowRight } from 'lucide-react'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin: (user: User, token: string) => void
}

export function LoginDialog({ open, onOpenChange, onLogin }: LoginDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [step, setStep] = useState<'select' | 'password' | 'setup_nickname' | 'setup_password'>('select')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [adminNickname, setAdminNickname] = useState('')

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at')
    setUsers(data || [])
    
    // 如果没有用户，说明是首次使用
    if (!data || data.length === 0) {
      setIsFirstTime(true)
      setStep('setup_nickname')
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchUsers()
    }
  }, [open, fetchUsers])

  const handleSelectUser = (user: User) => {
    setSelectedUser(user)
    if (user.is_first_login) {
      // 新用户首次登录，进入设置密码流程
      setStep('setup_password')
    } else {
      setStep('password')
    }
  }

  const handlePasswordSubmit = async (password: string) => {
    if (!selectedUser) return

    const isValid = await verifyPassword(password, selectedUser.password_hash)
    if (isValid) {
      const token = generateToken(selectedUser)
      onLogin(selectedUser, token)
      onOpenChange(false)
      resetState()
    } else {
      alert('密码错误')
    }
  }

  const handleAdminNicknameSubmit = () => {
    if (!adminNickname.trim()) {
      alert('请输入昵称')
      return
    }
    setStep('setup_password')
  }

  const handleSetupPasswordSubmit = async (password: string) => {
    if (isFirstTime) {
      // 首次使用，创建厨子账号
      const passwordHash = await hashPassword(password)
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          nickname: adminNickname.trim() || '厨子',
          role: 'chef',
          password_hash: passwordHash,
          is_first_login: false,
        })
        .select()
        .single()

      if (error) {
        alert('创建失败：' + error.message)
        return
      }

      if (user) {
        const token = generateToken(user)
        onLogin(user, token)
        onOpenChange(false)
        resetState()
      }
    } else if (selectedUser) {
      // 设置新用户密码
      const passwordHash = await hashPassword(password)
      const { data: user, error } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          is_first_login: false,
        })
        .eq('id', selectedUser.id)
        .select()
        .single()

      if (error) {
        alert('设置密码失败：' + error.message)
        return
      }

      if (user) {
        const token = generateToken(user)
        onLogin(user, token)
        onOpenChange(false)
        resetState()
      }
    }
  }

  const resetState = () => {
    setStep('select')
    setSelectedUser(null)
    setIsFirstTime(false)
    setAdminNickname('')
  }

  const handleClose = () => {
    onOpenChange(false)
    resetState()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === 'select' && '选择你的身份'}
            {step === 'password' && `欢迎回来，${selectedUser?.nickname}`}
            {step === 'setup_nickname' && '欢迎使用干饭厨子'}
            {step === 'setup_password' && (isFirstTime ? '设置管理员密码' : `设置密码 - ${selectedUser?.nickname}`)}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="py-4">
            {users.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                暂无用户，请先创建
              </div>
            ) : (
              <ScrollArea className="h-72">
                <div className="grid grid-cols-2 gap-3 p-1">
                  {users.map((user) => (
                    <Button
                      key={user.id}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2 rounded-2xl hover:bg-primary/10 hover:border-primary/50 transition-all"
                      onClick={() => handleSelectUser(user)}
                    >
                      {user.role === 'chef' ? (
                        <ChefHat className="w-6 h-6 text-primary" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                      <span className="font-medium">{user.nickname}</span>
                      {user.is_first_login && (
                        <span className="text-xs text-primary">需设置密码</span>
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {step === 'password' && (
          <Numpad
            title="输入6位数字密码"
            onSubmit={handlePasswordSubmit}
            onCancel={() => setStep('select')}
          />
        )}

        {step === 'setup_nickname' && (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                首次使用，请先设置管理员信息
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>管理员昵称</Label>
              <Input
                placeholder="例如：大厨、爸爸、妈妈..."
                value={adminNickname}
                onChange={(e) => setAdminNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminNicknameSubmit()}
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <Button
              className="w-full h-12 bg-primary hover:bg-primary/90"
              onClick={handleAdminNicknameSubmit}
              disabled={!adminNickname.trim()}
            >
              下一步
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {step === 'setup_password' && (
          <div className="py-4">
            {isFirstTime && adminNickname && (
              <p className="text-center text-sm text-muted-foreground mb-4">
                为 <span className="font-medium text-foreground">{adminNickname}</span> 设置6位数字密码
              </p>
            )}
            {!isFirstTime && selectedUser && (
              <p className="text-center text-sm text-muted-foreground mb-4">
                首次登录，请设置6位数字密码
              </p>
            )}
            <Numpad
              title="设置6位数字密码"
              onSubmit={handleSetupPasswordSubmit}
              onCancel={isFirstTime ? undefined : () => setStep('select')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
