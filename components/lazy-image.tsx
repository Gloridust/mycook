'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'

// In-memory cache: dishId -> images array (persists across navigations within session)
const dishImageCache = new Map<string, string[]>()

interface LazyImageProps {
  /** Direct image source (base64 or URL) - skips fetch */
  src?: string
  /** Dish ID to fetch image on demand when visible */
  dishId?: string
  alt: string
  className?: string
  /** Shown when fetch completes but dish has no images */
  fallback?: ReactNode
}

export function LazyImage({ src, dishId, alt, className, fallback }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(src || null)
  const [fetchDone, setFetchDone] = useState(!!src)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = imgRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '150px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Fetch image by dishId when scrolled into view
  useEffect(() => {
    if (!isInView || !dishId || fetchDone) return

    // Check cache first
    const cached = dishImageCache.get(dishId)
    if (cached !== undefined) {
      if (cached.length > 0) setImageSrc(cached[0])
      setFetchDone(true)
      return
    }

    let cancelled = false
    supabase
      .from('dishes')
      .select('images')
      .eq('id', dishId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const images = data?.images || []
        dishImageCache.set(dishId, images)
        if (images.length > 0) setImageSrc(images[0])
        setFetchDone(true)
      })

    return () => { cancelled = true }
  }, [isInView, dishId, fetchDone])

  const showSkeleton = !fetchDone || (!isLoaded && imageSrc)
  const showFallback = fetchDone && !imageSrc && fallback

  return (
    <div ref={imgRef} className={`relative ${className || ''}`}>
      {showSkeleton && <Skeleton className="absolute inset-0" />}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>
      )}
      {isInView && imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  )
}

/** Invalidate cache for a specific dish (call after image update) */
export function invalidateDishImageCache(dishId: string) {
  dishImageCache.delete(dishId)
}

/** Clear all cached images */
export function clearDishImageCache() {
  dishImageCache.clear()
}
