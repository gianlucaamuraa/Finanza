import {
  Baby, Banknote, Book, Briefcase, Bus, CalendarClock, Car, Clapperboard, Coffee, CreditCard, Dog, Dumbbell,
  Fuel, Gift, GraduationCap, Hammer, HeartPulse, House, Landmark, Lightbulb, Music, PiggyBank, Pill, Plane,
  Receipt, Scissors, Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone, Tag, Ticket, TreePalm, TrendingUp,
  Tv, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  baby: Baby, banknote: Banknote, book: Book, briefcase: Briefcase, bus: Bus, "calendar-clock": CalendarClock,
  car: Car, clapperboard: Clapperboard, coffee: Coffee, "credit-card": CreditCard, dog: Dog, dumbbell: Dumbbell,
  fuel: Fuel, gift: Gift, "graduation-cap": GraduationCap, hammer: Hammer, "heart-pulse": HeartPulse, house: House,
  landmark: Landmark, lightbulb: Lightbulb, music: Music, "piggy-bank": PiggyBank, pill: Pill, plane: Plane,
  receipt: Receipt, scissors: Scissors, shield: Shield, shirt: Shirt, "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart, smartphone: Smartphone, tag: Tag, ticket: Ticket, "tree-palm": TreePalm,
  "trending-up": TrendingUp, tv: Tv, utensils: Utensils, wallet: Wallet, wifi: Wifi, wrench: Wrench, zap: Zap,
};

export function Icon({ name, size = 18, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const C = (name && ICONS[name]) || Tag;
  return <C size={size} strokeWidth={1.9} className={className} aria-hidden />;
}

/** Icona dentro il riquadro arrotondato usato nelle liste. */
export function IconBox({ name, color, small }: { name: string | null | undefined; color?: string; small?: boolean }) {
  return (
    <span className={`ico${small ? " sm" : ""}`} style={color ? { background: color + "1a", color } : undefined}>
      <Icon name={name} size={small ? 16 : 18} />
    </span>
  );
}
