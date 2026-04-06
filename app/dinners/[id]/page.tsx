'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LazyImage } from '@/components/lazy-image'
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
  Filter,
  Loader2,
  ShoppingCart
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
  const [orderingDishId, setOrderingDishId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Parallel data fetching for better performance
    const [dinnerRes, dishesRes, ordersRes, reviewsRes] = await Promise.all([
      supabase.from('dinners').select('*').eq('id', dinnerId).single(),
      supabase.from('dishes').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, user:users(nickname)').eq('dinner_id', dinnerId),
      supabase.from('reviews').select('*, user:users(nickname)').eq('dinner_id', dinnerId).order('created_at', { ascending: false }),
    ])

    if (dinnerRes.data) {
      setDinner(dinnerRes.data)
      setEditedDinner({
        title: dinnerRes.data.title,
        diningTime: dinnerRes.data.dining_time.slice(0, 16),
        orderDeadline: dinnerRes.data.order_deadline.slice(0, 16)
      })
    }
    setDishes(dishesRes.data || [])
    setOrders(ordersRes.data || [])
    setReviews(reviewsRes.data || [])
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

  const deadlinePassed = useMemo(() => {
    if (!dinner) return false
    return new Date(dinner.order_deadline) < new Date()
  }, [dinner])

  const diningPassed = useMemo(() => {
    if (!dinner) return false
    return new Date(dinner.dining_time) < new Date()
  }, [dinner])

  const canModify = useMemo(() => {
    if (!dinner) return false
    if (!dinner.allow_modify) return false
    if (deadlinePassed) return false
    return true
  }, [dinner, deadlinePassed])

  // Build lookup maps for O(1) access
  const ordersByDish = useMemo(() => {
    const map = new Map<string, OrderWithUser[]>()
    for (const order of orders) {
      const list = map.get(order.dish_id) || []
      list.push(order)
      map.set(order.dish_id, list)
    }
    return map
  }, [orders])

  const myOrderedDishIds = useMemo(() => {
    if (!user) return new Set<string>()
    return new Set(orders.filter(o => o.user_id === user.id).map(o => o.dish_id))
  }, [orders, user])

  const myOrderCount = myOrderedDishIds.size

  const filteredDishes = useMemo(() => {
    if (!showOnlyOrdered) return dishes
    return dishes.filter(d => ordersByDish.has(d.id))
  }, [dishes, showOnlyOrdered, ordersByDish])

  const handleOrder = async (dishId: string) => {
    if (!user || !canModify || orderingDishId) return

    setOrderingDishId(dishId)
    try {
      if (myOrderedDishIds.has(dishId)) {
        const order = orders.find(o => o.dish_id === dishId && o.user_id === user.id)
        if (order) {
          await supabase.from('orders').delete().eq('id', order.id)
        }
      } else {
        await supabase.from('orders').insert({
          dinner_id: dinnerId,
          dish_id: dishId,
          user_id: user.id,
        })
      }
      await fetchData()
    } finally {
      setOrderingDishId(null)
    }
  }

  const handleToggleModify = async () => {
    if (!dinner || user?.role !== 'chef') return
    await supabase.from('dinners').update({ allow_modify: !dinner.allow_modify }).eq('id', dinnerId)
    fetchData()
  }

  const handleUpdateDinner = async () => {
    if (!dinner || isUpdatingDinner) return
    setIsUpdatingDinner(true)
    try {
      await supabase.from('dinners').update({
        title: editedDinner.title,
        dining_time: toISOStringWithTimezone(editedDinner.diningTime),
        order_deadline: toISOStringWithTimezone(editedDinner.orderDeadline),
      }).eq('id', dinnerId)
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

  const hasReviewed = reviews.some(r => r.user_id === user?.id)
  const isChef = user?.role === 'chef'

  if (loading || !dinner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => router.push('/dinners')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{dinner.title}</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant={deadlinePassed ? "secondary" : "default"} className="h-4 text-[10px] px-1.5 rounded-full">
                  {deadlinePassed ? '已截止' : '点菜中'}
                </Badge>
                <span>{orders.length} 道菜被点</span>
              </div>
            </div>
          </div>

          {isChef && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleModify}
                className={`h-7 text-xs px-2 ${dinner.allow_modify ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Power className="w-3.5 h-3.5 mr-1" />
                {dinner.allow_modify ? '开放' : '关闭'}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDialogOpen(true)}>
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Compact info bar */}
        <div className="px-4 pb-2 max-w-3xl mx-auto flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            用餐 {format(dinner.dining_time, 'MM月dd日 HH:mm')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            截止 {format(dinner.order_deadline, 'MM月dd日 HH:mm')}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto">
        <Tabs defaultValue="order" className="w-full">
          <div className="sticky top-[88px] z-[9] bg-background/80 backdrop-blur-md px-4 pt-2 pb-1">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="order" className="text-sm">点菜</TabsTrigger>
              <TabsTrigger value="reviews" className="text-sm" disabled={!diningPassed}>
                评价 {diningPassed && reviews.length > 0 && `(${reviews.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="order" className="mt-0 px-4 pt-2 pb-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setShowOnlyOrdered(false)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  !showOnlyOrdered
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                全部 ({dishes.length})
              </button>
              <button
                onClick={() => setShowOnlyOrdered(true)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  showOnlyOrdered
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Filter className="w-3 h-3 inline mr-1" />
                已点 ({dishes.filter(d => ordersByDish.has(d.id)).length})
              </button>
            </div>

            {!canModify && !deadlinePassed && (
              <div className="bg-muted rounded-lg p-2.5 text-xs text-center text-muted-foreground mb-3">
                当前禁止修改点菜
              </div>
            )}

            {deadlinePassed && !diningPassed && (
              <div className="bg-primary/10 rounded-lg p-2.5 text-xs text-center text-primary mb-3">
                点菜已截止，等待用餐
              </div>
            )}

            {filteredDishes.length === 0 ? (
              <div className="text-center py-16">
                <ChefHat className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {showOnlyOrdered ? '还没有点任何菜' : '暂无可用菜品'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDishes.map((dish) => {
                  const dishOrders = ordersByDish.get(dish.id) || []
                  const ordered = myOrderedDishIds.has(dish.id)
                  const orderNames = dishOrders.map(o => o.user?.nickname || '').filter(Boolean)
                  const isOrdering = orderingDishId === dish.id

                  return (
                    <div
                      key={dish.id}
                      className={`flex items-center gap-3 p-2 rounded-xl bg-card transition-all ${
                        ordered ? 'ring-1.5 ring-primary/60 shadow-sm' : 'shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted">
                        {dish.images && dish.images.length > 0 ? (
                          <LazyImage src={dish.images[0]} alt={dish.title} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ChefHat className="w-5 h-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <h3 className="font-medium text-sm truncate">{dish.title}</h3>
                        {dish.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{dish.description}</p>
                        )}
                        {orderNames.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[11px] text-muted-foreground truncate">
                              {orderNames.join('、')}
                            </span>
                          </div>
                        )}
                        {orderNames.length === 0 && !dish.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">暂无人点</p>
                        )}
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {canModify ? (
                          <button
                            onClick={() => handleOrder(dish.id)}
                            disabled={isOrdering}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isOrdering
                                ? 'bg-muted'
                                : ordered
                                  ? 'bg-red-50 text-destructive hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50'
                                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            {isOrdering ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : ordered ? (
                              <Minus className="w-4 h-4" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </button>
                        ) : ordered ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-primary/10 text-primary">
                            已点
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-0 px-4 pt-2 pb-4 space-y-3">
            {diningPassed && (
              <>
                {!hasReviewed && (
                  <Button
                    className="w-full h-10 rounded-xl"
                    onClick={() => setReviewDialogOpen(true)}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    写评价
                  </Button>
                )}

                {reviews.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">暂无评价</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-card rounded-xl p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-sm">{review.user?.nickname}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating bottom order summary bar */}
      {myOrderCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-md border-t border-border safe-bottom">
          <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {myOrderCount}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                已点 <strong className="text-foreground">{myOrderCount}</strong> 道菜
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs rounded-full"
              onClick={() => setShowOnlyOrdered(true)}
            >
              查看已点
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dinner Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑饭局</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">饭局名称</Label>
              <Input
                value={editedDinner.title}
                onChange={(e) => setEditedDinner(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">用餐时间</Label>
              <Input
                type="datetime-local"
                value={editedDinner.diningTime}
                onChange={(e) => setEditedDinner(prev => ({ ...prev, diningTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">点菜截止时间</Label>
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
              {isUpdatingDinner ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</> : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>评价这顿饭</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">评分</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                    className="p-0.5"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= newReview.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">评价（可选）</Label>
              <Textarea
                placeholder="写下你的用餐体验..."
                value={newReview.comment}
                onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReviewDialogOpen(false)} disabled={isSubmittingReview}>
              取消
            </Button>
            <Button className="flex-1 bg-primary" onClick={handleSubmitReview} disabled={isSubmittingReview}>
              {isSubmittingReview ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 提交中...</> : '提交评价'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
