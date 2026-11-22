import type { ComponentType } from 'react';
// Seul fichier de l'application autorisé à importer lucide-react-native (règle ESLint no-restricted-imports
// et test __tests__/iconsGuard.test.ts). Import ICÔNE PAR ICÔNE : Metro n'élague pas l'arbre, un import
// depuis la racine embarquerait les 4 600 icônes. Liste = table 4.3 de docs/design/03-composants.md.
import Heart from 'lucide-react-native/icons/heart';
import Layers from 'lucide-react-native/icons/layers';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import User from 'lucide-react-native/icons/user';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import Trash2 from 'lucide-react-native/icons/trash-2';
import CircleX from 'lucide-react-native/icons/circle-x';
import Check from 'lucide-react-native/icons/check';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import Clock from 'lucide-react-native/icons/clock';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Info from 'lucide-react-native/icons/info';
import Phone from 'lucide-react-native/icons/phone';
import Video from 'lucide-react-native/icons/video';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Search from 'lucide-react-native/icons/search';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Send from 'lucide-react-native/icons/send';
import Flag from 'lucide-react-native/icons/flag';
import Ban from 'lucide-react-native/icons/ban';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import MapPin from 'lucide-react-native/icons/map-pin';
import Globe from 'lucide-react-native/icons/globe';
import Undo2 from 'lucide-react-native/icons/undo-2';
import Lock from 'lucide-react-native/icons/lock';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Camera from 'lucide-react-native/icons/camera';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Pencil from 'lucide-react-native/icons/pencil';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Mic from 'lucide-react-native/icons/mic';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import MicOff from 'lucide-react-native/icons/mic-off';
import VideoOff from 'lucide-react-native/icons/video-off';
import Volume2 from 'lucide-react-native/icons/volume-2';
import PhoneOff from 'lucide-react-native/icons/phone-off';
import SwitchCamera from 'lucide-react-native/icons/switch-camera';
import Copy from 'lucide-react-native/icons/copy';
import WifiOff from 'lucide-react-native/icons/wifi-off';

/** Contrat minimal d'une icône du jeu (sous-ensemble des propriétés de Lucide). */
export type IconGlyph = ComponentType<{ color?: string; size?: number; strokeWidth?: number; fill?: string }>;

/** Registre des icônes disponibles. Ajouter une icône = l'importer ci-dessus, l'ajouter ici et dans le test du registre. */
export const ICON_REGISTRY = {
  Heart,
  Layers,
  MessageCircle,
  User,
  Star,
  X,
  Trash2,
  CircleX,
  Check,
  BadgeCheck,
  CircleCheck,
  CheckCheck,
  Clock,
  CircleAlert,
  TriangleAlert,
  Info,
  Phone,
  Video,
  Ellipsis,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  SlidersHorizontal,
  Search,
  Eye,
  EyeOff,
  Send,
  Flag,
  Ban,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Globe,
  Undo2,
  Lock,
  Sparkles,
  Camera,
  ImagePlus,
  Pencil,
  ChevronDown,
  Mic,
  Pause,
  Play,
  MicOff,
  VideoOff,
  Volume2,
  PhoneOff,
  SwitchCamera,
  Copy,
  WifiOff,
} satisfies Record<string, IconGlyph>;

export type IconName = keyof typeof ICON_REGISTRY;

export const ICON_NAMES = Object.keys(ICON_REGISTRY) as IconName[];
