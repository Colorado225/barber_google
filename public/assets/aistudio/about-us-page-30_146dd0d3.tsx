import { Card, CardContent } from '@/components/ui/card'
import { MotionPreset } from '@/components/ui/motion-preset'
import ProfileCarousel from '@/components/shadcn-studio/blocks/about-us-page-30/profile-carousel'
import MusicPlayerCard from '@/components/shadcn-studio/blocks/about-us-page-30/music-player-card'
import TripFolderCard from '@/components/shadcn-studio/blocks/about-us-page-30/trip-folder-card'
import SurpriseNote from '@/components/shadcn-studio/blocks/about-us-page-30/surprise-note'

const AboutUsPage = () => {
  return (
    <section className='bg-background py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:space-y-16 lg:px-8'>
        <div className='space-y-2'>
          <MotionPreset fade blur slide={{ direction: 'down', offset: 50 }} transition={{ duration: 0.5 }}>
            <p className='text-primary text-lg font-medium italic sm:text-xl'>{'// About me'}</p>
          </MotionPreset>
          <MotionPreset
            component='h2'
            className='text-2xl font-semibold sm:text-3xl lg:text-4xl'
            fade
            blur
            delay={0.2}
            slide={{ direction: 'down', offset: 50 }}
            transition={{ duration: 0.5 }}
          >
            The person behind the pixels
          </MotionPreset>
        </div>

        <MotionPreset
          fade
          blur
          delay={0.4}
          slide={{ direction: 'down', offset: 50 }}
          transition={{ duration: 0.5 }}
          className='grid grid-cols-1 gap-6 md:grid-cols-[380px_1fr]'
        >
          <ProfileCarousel />

          <div className='grid gap-4 md:h-130 lg:grid-cols-2 lg:grid-rows-2'>
            <MusicPlayerCard />

            <TripFolderCard />

            <Card className='ring-foreground/10 bg-muted overflow-visible rounded-3xl shadow-none ring-1 max-lg:hidden max-md:h-70 max-md:min-h-50 sm:col-span-2'>
              <CardContent className='h-full max-md:px-4'>
                <SurpriseNote />
              </CardContent>
            </Card>
          </div>
        </MotionPreset>
      </div>
    </section>
  )
}

export default AboutUsPage
