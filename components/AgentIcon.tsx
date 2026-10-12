import {
  Bot,
  Sparkles,
  PenLine,
  Briefcase,
  Wallet,
  Heart,
  House,
  BookOpen,
  Code,
  Image as ImageIcon,
  Lightbulb,
  CalendarDays,
  GraduationCap,
  Plane,
  Utensils,
  Palette,
  FileText,
  Brain,
  type LucideIcon,
} from "lucide-react";

export const AGENT_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  bot: { icon: Bot, label: "רובוט" },
  sparkles: { icon: Sparkles, label: "ניצוצות" },
  pen: { icon: PenLine, label: "כתיבה" },
  briefcase: { icon: Briefcase, label: "עבודה" },
  wallet: { icon: Wallet, label: "כספים" },
  heart: { icon: Heart, label: "אישי" },
  house: { icon: House, label: "בית" },
  book: { icon: BookOpen, label: "לימוד" },
  code: { icon: Code, label: "קוד" },
  image: { icon: ImageIcon, label: "תמונה" },
  lightbulb: { icon: Lightbulb, label: "רעיונות" },
  calendar: { icon: CalendarDays, label: "תכנון" },
  graduation: { icon: GraduationCap, label: "השכלה" },
  plane: { icon: Plane, label: "טיולים" },
  food: { icon: Utensils, label: "אוכל" },
  palette: { icon: Palette, label: "עיצוב" },
  file: { icon: FileText, label: "מסמכים" },
  brain: { icon: Brain, label: "חשיבה" },
};

export const DEFAULT_ICON = "bot";

export function AgentIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = AGENT_ICONS[name ?? DEFAULT_ICON]?.icon ?? Bot;
  return <Icon className={className} aria-hidden />;
}
