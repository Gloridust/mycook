'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  Trash2,
  Upload,
  X,
  Loader2
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

// 懒加载图片组件
function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!isLoaded && (
        <Skeleton className="absolute inset-0" />
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  )
}

// 压缩图片到指定大小以下（256KB）
async function compressImage(file: File, maxSizeKB: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        
        // 最大尺寸限制（防止图片过大）
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width / height > MAX_WIDTH / MAX_HEIGHT) {
            height = Math.round(height * MAX_WIDTH / width)
            width = MAX_WIDTH
          } else {
            width = Math.round(width * MAX_HEIGHT / height)
            height = MAX_HEIGHT
          }
        }
        
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建 canvas context'))
          return
        }
        
        ctx.drawImage(img, 0, 0, width, height)
        
        // 尝试不同的质量来压缩到目标大小
        let quality = 0.9
        let base64 = canvas.toDataURL('image/jpeg', quality)
        
        // 计算 base64 大小（约等于原始大小的 4/3）
        const getBase64Size = (base64Str: string) => {
          const base64Length = base64Str.split(',')[1].length
          return (base64Length * 3) / 4 / 1024 // KB
        }
        
        // 如果还是太大，降低质量
        while (getBase64Size(base64) > maxSizeKB && quality > 0.1) {
          quality -= 0.1
          base64 = canvas.toDataURL('image/jpeg', quality)
        }
        
        // 如果质量已经很低还是太大，进一步缩小尺寸
        if (getBase64Size(base64) > maxSizeKB) {
          const scale = 0.8
          canvas.width = width * scale
          canvas.height = height * scale
          ctx.drawImage(img, 0, 0, width * scale, height * scale)
          base64 = canvas.toDataURL('image/jpeg', 0.7)
        }
        
        resolve(base64)
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newDish, setNewDish] = useState({ title: '', description: '', images: [] as string[] })
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (newDish.images.length >= 5) {
      alert('最多只能上传5张图片')
      return
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }
    
    setIsCompressing(true)
    try {
      const compressedBase64 = await compressImage(file, 256)
      setNewDish(prev => ({ ...prev, images: [...prev.images, compressedBase64] }))
    } catch (error) {
      alert('图片压缩失败，请重试')
      console.error('压缩失败:', error)
    } finally {
      setIsCompressing(false)
      // 清空 input 以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setNewDish(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleAddDish = async () => {
    if (!user || !newDish.title.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
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
      } else {
        alert('上架失败：' + error.message)
      }
    } finally {
      setIsSubmitting(false)
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
                        <LazyImage
                          src={dish.images[0]}
                          alt={dish.title}
                          className="w-full h-full"
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
              <Label>图片（最多5张，每张自动压缩至256KB以内）</Label>
              
              {/* 隐藏的文件输入 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              
              {/* 上传按钮 */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={newDish.images.length >= 5 || isCompressing}
              >
                {isCompressing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    <span className="text-sm text-muted-foreground">压缩中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {newDish.images.length >= 5 ? '已达到上限' : '点击选择图片'}
                    </span>
                  </div>
                )}
              </Button>
              
              {/* 图片预览 */}
              {newDish.images.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {newDish.images.map((base64, index) => (
                    <div key={index} className="relative group">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border">
                        <img
                          src={base64}
                          alt={`图片${index + 1}`}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 right-1 text-center">
                        <span className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                          {Math.round((base64.length * 3) / 4 / 1024)}KB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                已上传 {newDish.images.length}/5 张
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)} disabled={isSubmitting}>
              取消
            </Button>
            <Button 
              className="flex-1 bg-primary" 
              onClick={handleAddDish}
              disabled={!newDish.title.trim() || isCompressing || isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 上架中...</>
              ) : (
                '上架菜品'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
