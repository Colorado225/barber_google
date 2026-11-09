'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

const NOTES = [
  { text: 'Grab it and get surprise', position: 'top-[10%] left-[12%] -rotate-8' },
  { text: 'Did you try it again? You silly gullible', position: 'top-[4%] left-[62%] rotate-10' },
  { text: 'Noob :)', position: 'top-[3%] left-[3%] -rotate-6' },
  { text: "Don't try, U can't", position: 'top-[54%] left-[68%] rotate-12' },
  { text: 'Haha, you fall for everything!', position: 'top-[45%] left-[36%] rotate-4' },
  { text: 'Come on, I gave up <', position: '-top-[2%] -left-[3%] -rotate-10' }
]

const SurpriseNote = () => {
  const [step, setStep] = useState(0)
  const note = NOTES[step]

  return (
    <div className='relative h-full'>
      <div className='bg-background absolute top-8 right-[16%] left-[16%] h-2 rounded-full' />

      <div
        onMouseEnter={() => setStep(prev => (prev + 1) % NOTES.length)}
        className={cn('absolute z-10 w-32 cursor-pointer transition-all duration-500', note.position)}
      >
        <img
          src='https://cdn.shadcnstudio.com/ss-assets/template/landing-page/zolt/note.png'
          alt=''
          aria-hidden='true'
          loading='lazy'
          className='w-full'
        />
        <p className='absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-neutral-800 italic'>
          {note.text}
        </p>
      </div>

      <p className='text-card-foreground absolute bottom-0 left-[10%] text-2xl font-medium sm:text-nowrap md:left-1/2 md:-translate-x-1/2'>
        I have a surprise for you 🙃
      </p>
    </div>
  )
}

export default SurpriseNote
