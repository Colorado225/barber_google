// Icône dynamique choisie par le SuperAdmin dans les sections configurables.
import { Award, Clock, Scissors, ShieldCheck, Smartphone, Sparkles, Star } from 'lucide-react';

export function DynamicIcon({ name }: { name: string }) {
  switch (name) {
    case 'Scissors':
      return <Scissors className="w-5 h-5 text-[#C9A45C]" />;
    case 'Clock':
      return <Clock className="w-5 h-5 text-[#C9A45C]" />;
    case 'Smartphone':
      return <Smartphone className="w-5 h-5 text-[#C9A45C]" />;
    case 'Star':
      return <Star className="w-5 h-5 text-[#C9A45C]" />;
    case 'Sparkles':
      return <Sparkles className="w-5 h-5 text-[#C9A45C]" />;
    case 'ShieldCheck':
      return <ShieldCheck className="w-5 h-5 text-[#C9A45C]" />;
    case 'Award':
    default:
      return <Award className="w-5 h-5 text-[#C9A45C]" />;
  }
}
