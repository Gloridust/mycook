'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Delete, Check } from 'lucide-react'

interface NumpadProps {
  onSubmit: (code: string) => void
  onCancel?: () => void
  maxLength?: number
  title?: string
}

export function Numpad({ onSubmit, onCancel, maxLength = 6, title = '输入密码' }: NumpadProps) {
  const [code, setCode] = useState('')

  const handleNumber = (num: string) => {
    if (code.length < maxLength) {
      setCode(prev => prev + num)
    }
  }

  const handleDelete = () => {
    setCode(prev => prev.slice(0, -1))
  }

  const handleSubmit = () => {
    if (code.length === maxLength) {
      onSubmit(code)
      setCode('') // 提交后清空
    }
  }

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      
      {/* 密码显示 */}
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < code.length ? 'bg-primary scale-110' : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {/* 数字键盘 */}
      <div className="grid grid-cols-3 gap-3">
        {numbers.map((num, index) => {
          if (num === '') {
            return <div key={index} className="w-16 h-16" />
          }
          
          if (num === 'delete') {
            return (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="icon"
                className="w-16 h-16 rounded-2xl text-xl"
                onClick={handleDelete}
                disabled={code.length === 0}
              >
                <Delete className="w-6 h-6" />
              </Button>
            )
          }

          return (
            <Button
              key={index}
              type="button"
              variant="outline"
              className="w-16 h-16 rounded-2xl text-xl font-medium hover:bg-primary/10 hover:border-primary/50 transition-all active:scale-95"
              onClick={() => handleNumber(num)}
              disabled={code.length >= maxLength}
            >
              {num}
            </Button>
          )
        })}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 w-full">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={onCancel}
          >
            取消
          </Button>
        )}
        <Button
          type="button"
          className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
          onClick={handleSubmit}
          disabled={code.length !== maxLength}
        >
          <Check className="w-5 h-5 mr-2" />
          确认
        </Button>
      </div>
    </div>
  )
}
