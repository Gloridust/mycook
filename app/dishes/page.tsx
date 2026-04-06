'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LazyImage, invalidateDishImageCache } from '@/components/lazy-image'
import { supabase, type User } from '@/lib/supabase'

/** Dish metadata without images - fetched lightweight for fast page load */
type DishMeta = {
  id: string
  title: string
  description: string | null
  status: 'active' | 'inactive'
  created_by: string
  created_at: string
}
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

// Compress image to target size (256KB)
async function compressImage(file: File, maxSizeKB: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

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

        let quality = 0.9
        let base64 = canvas.toDataURL('image/jpeg', quality)

        const getBase64Size = (base64Str: string) => {
          const base64Length = base64Str.split(',')[1].length
          return (base64Length * 3) / 4 / 1024
        }

        while (getBase64Size(base64) > maxSizeKB && quality > 0.1) {
          quality -= 0.1
          base64 = canvas.toDataURL('image/jpeg', quality)
        }

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
  const [dishes, setDishes] = useState<DishMeta[]>([])
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
      .select('id, title, description, status, created_by, created_at')
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

  const handleToggleStatus = async (dish: DishMeta) => {
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5 max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <ChefHat className="w-5 h-5 text-primary" />
              <h1 className="text-base font-bold">菜品列表</h1>
            </div>
          </div>

          {isChef && (
            <Button onClick={() => setAddDialogOpen(true)} size="sm" className="rounded-full h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              上架菜品
            </Button>
          )}
        </div>
      </header>

      {/* Dishes Grid */}
      <main className="p-3 max-w-3xl mx-auto">
        {dishes.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">还没有菜品</p>
            {isChef && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setAddDialogOpen(true)}
              >
                上架第一个菜品
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {dishes.map((dish) => (
              <div
                key={dish.id}
                className={`rounded-xl overflow-hidden bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all ${
                  dish.status === 'inactive' ? 'opacity-50 grayscale' : ''
                }`}
              >
                {/* Square image - fetched on scroll */}
                <div className="relative aspect-square bg-muted">
                  <LazyImage
                    dishId={dish.id}
                    alt={dish.title}
                    className="w-full h-full"
                    fallback={<ImageIcon className="w-8 h-8 text-muted-foreground/30" />}
                  />

                  {dish.status === 'inactive' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Badge variant="secondary" className="text-[10px]">已下架</Badge>
                    </div>
                  )}

                  {isChef && (
                    <div className="absolute top-1.5 right-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full bg-white/80 shadow-sm">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[120px]">
                          <DropdownMenuItem onClick={() => handleToggleStatus(dish)}>
                            {dish.status === 'active' ? (
                              <><PowerOff className="w-3.5 h-3.5 mr-1.5" />下架</>
                            ) : (
                              <><Power className="w-3.5 h-3.5 mr-1.5" />上架</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteDish(dish.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <h3 className="font-medium text-sm truncate">{dish.title}</h3>
                  {dish.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {dish.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Dish Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上架新菜品</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">菜品名称</Label>
              <Input
                placeholder="输入菜品名称"
                value={newDish.title}
                onChange={(e) => setNewDish(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">描述（可选）</Label>
              <Textarea
                placeholder="输入菜品描述"
                value={newDish.description}
                onChange={(e) => setNewDish(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">图片（最多5张，自动压缩至256KB以内）</Label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                className="w-full h-20 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={newDish.images.length >= 5 || isCompressing}
              >
                {isCompressing ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-[11px] text-muted-foreground">压缩中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {newDish.images.length >= 5 ? '已达上限' : '点击选择图片'}
                    </span>
                  </div>
                )}
              </Button>

              {newDish.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newDish.images.map((base64, index) => (
                    <div key={index} className="relative group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border">
                        <img
                          src={base64}
                          alt={`图片${index + 1}`}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      <div className="absolute bottom-0.5 left-0.5 right-0.5 text-center">
                        <span className="text-[9px] bg-black/50 text-white px-1 py-px rounded">
                          {Math.round((base64.length * 3) / 4 / 1024)}KB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
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
