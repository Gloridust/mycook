'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, type Dinner, type User } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { 
  ArrowLeft, 
  Plus, 
  UtensilsCrossed, 
  Calendar, 
  Clock,
  ChevronRight,
  Trash2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from '@/lib/utils'

export default function DinnersPage() {
  const [dinners, setDinners] = useState<Dinner[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newDinner, setNewDinner] = useState({
    title: '',
    diningTime: '',
    orderDeadline: ''
  })
  const router = useRouter()

  const fetchDinners = useCallback(async () => {
    const { data } = await supabase
      .from('dinners')
      .select('*')
      .order('created_at', { ascending: false })
    
    setDinners(data || [])
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
    fetchDinners()
  }, [router, fetchDinners])

  const handleAddDinner = async () => {
    if (!user || !newDinner.title.trim() || !newDinner.diningTime || !newDinner.orderDeadline) return

    const { error } = await supabase.from('dinners').insert({
      title: newDinner.title,
      dining_time: newDinner.diningTime,
      order_deadline: newDinner.orderDeadline,
      allow_modify: true,
      created_by: user.id,
      status: 'active',
    })

    if (!error) {
      setAddDialogOpen(false)
      setNewDinner({ title: '', diningTime: '', orderDeadline: '' })
      fetchDinners()
    }
  }

  const handleDeleteDinner = async (dinnerId: string) => {
    if (!confirm('确定要删除这个饭局吗？')) return

    const { error } = await supabase
      .from('dinners')
      .delete()
      .eq('id', dinnerId)

    if (!error) {
      fetchDinners()
    }
  }

  const isOrderDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date()
  }

  const isDiningTimePassed = (diningTime: string) => {
    return new Date(diningTime) < new Date()
  }

  const isChef = user?.role === 'chef'

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
              <UtensilsCrossed className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">饭局列表</h1>
            </div>
          </div>
          
          <Button onClick={() => setAddDialogOpen(true)} className="rounded-full">
            <Plus className="w-4 h-4 mr-2" />
            新建饭局
          </Button>
        </div>
      </header>

      {/* Dinners List */}
      <main className="p-4 max-w-4xl mx-auto">
        {dinners.length === 0 ? (
          <div className="text-center py-20">
            <UtensilsCrossed className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">还没有饭局</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setAddDialogOpen(true)}
            >
              创建第一个饭局
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {dinners.map((dinner) => {
                const deadlinePassed = isOrderDeadlinePassed(dinner.order_deadline)
                const diningPassed = isDiningTimePassed(dinner.dining_time)
                
                return (
                  <motion.div
                    key={dinner.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => router.push(`/dinners/${dinner.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{dinner.title}</h3>
                              {deadlinePassed && !diningPassed && (
                                <Badge variant="secondary">截止点菜</Badge>
                              )}
                              {diningPassed && (
                                <Badge variant="outline">已结束</Badge>
                              )}
                              {!deadlinePassed && !diningPassed && (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">进行中</Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>用餐：{format(new Date(dinner.dining_time), 'MM月dd日 HH:mm')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>截止：{format(new Date(dinner.order_deadline), 'MM月dd日 HH:mm')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isChef && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteDinner(dinner.id)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Add Dinner Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建饭局</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>饭局名称</Label>
              <Input
                placeholder="例如：周末聚餐"
                value={newDinner.title}
                onChange={(e) => setNewDinner(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>用餐时间</Label>
              <Input
                type="datetime-local"
                value={newDinner.diningTime}
                onChange={(e) => setNewDinner(prev => ({ ...prev, diningTime: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>点菜截止时间</Label>
              <Input
                type="datetime-local"
                value={newDinner.orderDeadline}
                onChange={(e) => setNewDinner(prev => ({ ...prev, orderDeadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>
              取消
            </Button>
            <Button 
              className="flex-1 bg-primary" 
              onClick={handleAddDinner}
              disabled={!newDinner.title.trim() || !newDinner.diningTime || !newDinner.orderDeadline}
            >
              创建饭局
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
