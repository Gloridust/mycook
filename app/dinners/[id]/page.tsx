'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase, type Dish, type Dinner, type User, type Order, type Review } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Calendar,
  Users,
  Star,
  MessageSquare,
  Plus,
  Minus,
  Power,
  Edit3,
  Filter
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { format, toISOStringWithTimezone } from '@/lib/utils'

interface OrderWithUser extends Order {
  user?: { nickname: string }
}

interface ReviewWithUser extends Review {
  user?: { nickname: string }
}

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

export default function DinnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dinnerId = params.id as string

  const [dinner, setDinner] = useState<Dinner | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [orders, setOrders] = useState<OrderWithUser[]>([])
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [editedDinner, setEditedDinner] = useState({
    title: '',
    diningTime: '',
    orderDeadline: ''
  })
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' })
  const [showOnlyOrdered, setShowOnlyOrdered] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [isUpdatingDinner, setIsUpdatingDinner] = useState(false)

  const fetchData = useCallback(async () => {
    // 获取饭局信息
    const { data: dinnerData } = await supabase
      .from('dinners')
      .select('*')
      .eq('id', dinnerId)
      .single()
    
    if (dinnerData) {
      setDinner(dinnerData)
      setEditedDinner({
        title: dinnerData.title,
        diningTime: dinnerData.dining_time.slice(0, 16),
        orderDeadline: dinnerData.order_deadline.slice(0, 16)
      })
    }

    // 获取所有菜品
    const { data: dishesData } = await supabase
      .from('dishes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    setDishes(dishesData || [])

    // 获取点菜记录
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, user:users(nickname)')
      .eq('dinner_id', dinnerId)
    
    setOrders(ordersData || [])

    // 获取评价
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*, user:users(nickname)')
      .eq('dinner_id', dinnerId)
      .order('created_at', { ascending: false })
    
    setReviews(reviewsData || [])

    setLoading(false)
  }, [dinnerId])

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
    fetchData()
  }, [router, fetchData])

  const isOrderDeadlinePassed = () => {
    if (!dinner) return false
    return new Date(dinner.order_deadline) < new Date()
  }

  const isDiningTimePassed = () => {
    if (!dinner) return false
    return new Date(dinner.dining_time) < new Date()
  }

  const canModifyOrder = () => {
    if (!dinner) return false
    if (!dinner.allow_modify) return false
    if (isOrderDeadlinePassed()) return false
    return true
  }

  const getDishOrders = (dishId: string) => {
    return orders.filter(order => order.dish_id === dishId)
  }

  const hasOrdered = (dishId: string) => {
    return orders.some(order => order.dish_id === dishId && order.user_id === user?.id)
  }

  const isDishOrdered = (dishId: string) => {
    return orders.some(order => order.dish_id === dishId)
  }

  const handleOrder = async (dishId: string) => {
    if (!user || !canModifyOrder()) return

    if (hasOrdered(dishId)) {
      // 取消点菜
      const order = orders.find(o => o.dish_id === dishId && o.user_id === user.id)
      if (order) {
        await supabase.from('orders').delete().eq('id', order.id)
      }
    } else {
      // 点菜
      await supabase.from('orders').insert({
        dinner_id: dinnerId,
        dish_id: dishId,
        user_id: user.id,
      })
    }

    fetchData()
  }

  const handleToggleModify = async () => {
    if (!dinner || user?.role !== 'chef') return

    await supabase
      .from('dinners')
      .update({ allow_modify: !dinner.allow_modify })
      .eq('id', dinnerId)

    fetchData()
  }

  const handleUpdateDinner = async () => {
    if (!dinner || isUpdatingDinner) return

    setIsUpdatingDinner(true)
    try {
      await supabase
        .from('dinners')
        .update({
          title: editedDinner.title,
          dining_time: toISOStringWithTimezone(editedDinner.diningTime),
          order_deadline: toISOStringWithTimezone(editedDinner.orderDeadline),
        })
        .eq('id', dinnerId)

      setEditDialogOpen(false)
      fetchData()
    } finally {
      setIsUpdatingDinner(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!user || isSubmittingReview) return

    setIsSubmittingReview(true)
    try {
      await supabase.from('reviews').insert({
        dinner_id: dinnerId,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment,
      })

      setReviewDialogOpen(false)
      setNewReview({ rating: 5, comment: '' })
      fetchData()
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const hasReviewed = () => {
    return reviews.some(review => review.user_id === user?.id)
  }

  const isChef = user?.role === 'chef'

  if (loading || !dinner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const deadlinePassed = isOrderDeadlinePassed()
  const diningPassed = isDiningTimePassed()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dinners')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{dinner.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={deadlinePassed ? 'text-muted-foreground' : 'text-primary'}>
                  {deadlinePassed ? '已截止' : '点菜中'}
                </span>
                <span>·</span>
                <span>{orders.length} 道菜被点</span>
              </div>
            </div>
          </div>
          
          {isChef && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleModify}
                className={dinner.allow_modify ? 'text-primary border-primary/50' : ''}
              >
                <Power className="w-4 h-4 mr-1" />
                {dinner.allow_modify ? '允许修改' : '禁止修改'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Info Bar */}
      <div className="bg-muted/50 border-b border-border">
        <div className="max-w-4xl mx-auto p-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>用餐：{format(dinner.dining_time, 'MM月dd日 HH:mm')}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>截止：{format(dinner.order_deadline, 'MM月dd日 HH:mm')}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 max-w-4xl mx-auto">
        <Tabs defaultValue="order" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="order">点菜</TabsTrigger>
            <TabsTrigger value="reviews" disabled={!diningPassed}>
              评价 {diningPassed && reviews.length > 0 && `(${reviews.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="order" className="space-y-4">
            {/* 过滤器 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant={showOnlyOrdered ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyOrdered(!showOnlyOrdered)}
                  className={showOnlyOrdered ? "bg-primary" : ""}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  {showOnlyOrdered ? "只看已点" : "全部菜品"}
                </Button>
                {showOnlyOrdered && (
                  <span className="text-sm text-muted-foreground">
                    已点 {dishes.filter(d => isDishOrdered(d.id)).length} 道菜
                  </span>
                )}
              </div>
            </div>

            {!canModifyOrder() && !deadlinePassed && (
              <div className="bg-muted rounded-lg p-3 text-sm text-center text-muted-foreground">
                当前禁止修改点菜
              </div>
            )}
            
            {deadlinePassed && !diningPassed && (
              <div className="bg-primary/10 rounded-lg p-3 text-sm text-center text-primary">
                点菜已截止，等待用餐
              </div>
            )}

            {dishes.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">暂无可用菜品</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dishes.filter(dish => !showOnlyOrdered || isDishOrdered(dish.id)).length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Filter className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      {showOnlyOrdered ? '还没有点任何菜' : '暂无可用菜品'}
                    </p>
                  </div>
                ) : (
                  dishes
                    .filter(dish => !showOnlyOrdered || isDishOrdered(dish.id))
                    .map((dish) => {
                    const dishOrders = getDishOrders(dish.id)
                    const ordered = hasOrdered(dish.id)
                    const orderNames = dishOrders.map(o => o.user?.nickname || '').filter(Boolean)

                    return (
                      <Card key={dish.id} className={`overflow-hidden transition-all ${
                        ordered ? 'ring-2 ring-primary' : ''
                      }`}>
                        <div className="relative h-40 bg-muted">
                          {dish.images && dish.images.length > 0 ? (
                            <LazyImage
                              src={dish.images[0]}
                              alt={dish.title}
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ChefHat className="w-10 h-10 text-muted-foreground/30" />
                            </div>
                          )}
                          
                          {canModifyOrder() && (
                            <Button
                              size="sm"
                              className={`absolute bottom-2 right-2 rounded-full ${
                                ordered 
                                  ? 'bg-destructive hover:bg-destructive/90' 
                                  : 'bg-primary hover:bg-primary/90'
                              }`}
                              onClick={() => handleOrder(dish.id)}
                            >
                              {ordered ? (
                                <><Minus className="w-4 h-4 mr-1" /> 取消</>
                              ) : (
                                <><Plus className="w-4 h-4 mr-1" /> 点菜</>
                              )}
                            </Button>
                          )}

                          {ordered && !canModifyOrder() && (
                            <Badge className="absolute bottom-2 right-2 bg-primary">
                              已点
                            </Badge>
                          )}
                        </div>

                        <CardContent className="p-3">
                          <h3 className="font-medium mb-1">{dish.title}</h3>
                          
                          {orderNames.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{orderNames.join('、')}点了</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            {diningPassed && (
              <>
                {!hasReviewed() && (
                  <Button 
                    className="w-full" 
                    onClick={() => setReviewDialogOpen(true)}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    写评价
                  </Button>
                )}

                {reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">暂无评价</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <Card key={review.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{review.user?.nickname}</span>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">{review.rating}</span>
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dinner Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑饭局</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>饭局名称</Label>
              <Input
                value={editedDinner.title}
                onChange={(e) => setEditedDinner(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>用餐时间</Label>
              <Input
                type="datetime-local"
                value={editedDinner.diningTime}
                onChange={(e) => setEditedDinner(prev => ({ ...prev, diningTime: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>点菜截止时间</Label>
              <Input
                type="datetime-local"
                value={editedDinner.orderDeadline}
                onChange={(e) => setEditedDinner(prev => ({ ...prev, orderDeadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)} disabled={isUpdatingDinner}>
              取消
            </Button>
            <Button className="flex-1 bg-primary" onClick={handleUpdateDinner} disabled={isUpdatingDinner}>
              {isUpdatingDinner ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</>
              ) : (
                '保存'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>评价这顿饭</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>评分</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                    className="p-1"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        star <= newReview.rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>评价（可选）</Label>
              <Textarea
                placeholder="写下你的用餐体验..."
                value={newReview.comment}
                onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReviewDialogOpen(false)} disabled={isSubmittingReview}>
              取消
            </Button>
            <Button className="flex-1 bg-primary" onClick={handleSubmitReview} disabled={isSubmittingReview}>
              {isSubmittingReview ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 提交中...</>
              ) : (
                '提交评价'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
