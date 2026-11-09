'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

const IMAGES = [
  'https://cdn.shadcnstudio.com/ss-assets/template/landing-page/zolt/carousel-01.png',
  'https://cdn.shadcnstudio.com/ss-assets/template/landing-page/zolt/carousel-02.png',
  'https://cdn.shadcnstudio.com/ss-assets/template/landing-page/zolt/carousel-03.png',
  'https://cdn.shadcnstudio.com/ss-assets/template/landing-page/zolt/carousel-04.png'
]

const ProfileCarousel = () => {
  const [index, setIndex] = useState(0)

  const goPrev = () => setIndex(prev => (prev - 1 + IMAGES.length) % IMAGES.length)
  const goNext = () => setIndex(prev => (prev + 1) % IMAGES.length)

  return (
    <div className='relative row-span-2 h-130 overflow-hidden rounded-3xl'>
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt='Behind the scenes of the person featured in this section'
          loading='lazy'
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-500',
            i === index ? 'opacity-100' : 'opacity-0'
          )}
        />
      ))}

      <div className='absolute top-15 right-12 z-10 flex gap-0.5'>
        {IMAGES.map((src, i) => (
          <span
            key={src}
            className={cn(
              'block h-0.5 w-2.5 rounded-full bg-white transition-opacity duration-300',
              i === index ? 'opacity-100' : 'opacity-50'
            )}
          />
        ))}
      </div>

      <button
        type='button'
        onClick={goPrev}
        className='group/prev absolute inset-y-0 left-0 flex w-1/4 items-center justify-start pl-3 outline-none'
      >
        <span className='absolute inset-0 bg-linear-to-r from-black/30 to-transparent mask-[linear-gradient(to_right,black,transparent)] opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover/prev:opacity-100' />
        <ChevronLeftIcon className='relative size-5 -translate-x-2 text-white opacity-50 transition-all duration-300 group-hover/prev:translate-x-0 group-hover/prev:opacity-100' />
        <span className='sr-only'>Previous image</span>
      </button>

      <button
        type='button'
        onClick={goNext}
        className='group/next absolute inset-y-0 right-0 flex w-1/4 items-center justify-end pr-3 outline-none'
      >
        <span className='absolute inset-0 bg-linear-to-l from-black/30 to-transparent mask-[linear-gradient(to_left,black,transparent)] opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover/next:opacity-100' />
        <ChevronRightIcon className='relative size-5 translate-x-2 text-white opacity-50 transition-all duration-300 group-hover/next:translate-x-0 group-hover/next:opacity-100' />
        <span className='sr-only'>Next image</span>
      </button>
    </div>
  )
}

export default ProfileCarousel
