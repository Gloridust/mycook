'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, type Dish, type User } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { 
  ArrowLeft, 
  Plus, 
  ChefHat, 
  ImageIcon,
  MoreVertical,
  Power,
  PowerOff,
  Trash2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newDish, setNewDish] = useState({ title: '', description: '', images: [] as string[] })
  const [imageUrl, setImageUrl] = useState('')
  const router = useRouter()

  const fetchDishes = useCallback(async () => {
    const { data } = await supabase
      .from('dishes')
      .select('*')
      .order('created_at', { ascending: false })
    
    setDishes(data || [])
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
    fetchDishes()
  }, [router, fetchDishes])

  const handleAddImage = () => {
    if (imageUrl.trim() && newDish.images.length < 5) {
      setNewDish(prev => ({ ...prev, images: [...prev.images, imageUrl.trim()] }))
      setImageUrl('')
    }
  }

  const handleRemoveImage = (index: number) => {
    setNewDish(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleAddDish = async () => {
    if (!user || !newDish.title.trim()) return

    const { error } = await supabase.from('dishes').insert({
      title: newDish.title,
      description: newDish.description,
      images: newDish.images,
      status: 'active',
      created_by: user.id,
    })

    if (!error) {
      setAddDialogOpen(false)
      setNewDish({ title: '', description: '', images: [] })
      fetchDishes()
    }
  }

  const handleToggleStatus = async (dish: Dish) => {
    const newStatus = dish.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase
      .from('dishes')
      .update({ status: newStatus })
      .eq('id', dish.id)

    if (!error) {
      fetchDishes()
    }
  }

  const handleDeleteDish = async (dishId: string) => {
    if (!confirm('确定要删除这个菜品吗？')) return

    const { error } = await supabase
      .from('dishes')
      .delete()
      .eq('id', dishId)

    if (!error) {
      fetchDishes()
    }
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
              <ChefHat className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">菜品列表</h1>
            </div>
          </div>
          
          {isChef && (
            <Button onClick={() => setAddDialogOpen(true)} className="rounded-full">
              <Plus className="w-4 h-4 mr-2" />
              上架菜品
            </Button>
          )}
        </div>
      </header>

      {/* Dishes Grid */}
      <main className="p-4 max-w-4xl mx-auto">
        {dishes.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">还没有菜品</p>
            {isChef && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setAddDialogOpen(true)}
              >
                上架第一个菜品
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {dishes.map((dish) => (
                <motion.div
                  key={dish.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className={`overflow-hidden transition-all duration-300 ${
                    dish.status === 'inactive' ? 'opacity-60 grayscale' : ''
                  }`}>
                    {/* Image Gallery */}
                    <div className="relative h-48 bg-muted">
                      {dish.images && dish.images.length > 0 ? (
                        <Image
                          src={dish.images[0]}
                          alt={dish.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {dish.status === 'inactive' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Badge variant="secondary" className="text-sm">
                            已下架
                          </Badge>
                        </div>
                      )}

                      {isChef && (
                        <div className="absolute top-2 right-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleStatus(dish)}>
                                {dish.status === 'active' ? (
                                  <>
                                    <PowerOff className="w-4 h-4 mr-2" />
                                    下架
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4 mr-2" />
                                    上架
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteDish(dish.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}

                      {dish.images.length > 1 && (
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="bg-white/90">
                            +{dish.images.length - 1}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-1">{dish.title}</h3>
                      {dish.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {dish.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Add Dish Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上架新菜品</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>菜品名称</Label>
              <Input
                placeholder="输入菜品名称"
                value={newDish.title}
                onChange={(e) => setNewDish(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Textarea
                placeholder="输入菜品描述"
                value={newDish.description}
                onChange={(e) => setNewDish(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>图片链接（最多5张）</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="粘贴图片URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddImage}
                  disabled={newDish.images.length >= 5}
                >
                  添加
                </Button>
              </div>
              
              {newDish.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newDish.images.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                        <Image
                          src={url}
                          alt={`图片${index + 1}`}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>
              取消
            </Button>
            <Button 
              className="flex-1 bg-primary" 
              onClick={handleAddDish}
              disabled={!newDish.title.trim()}
            >
              上架菜品
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
