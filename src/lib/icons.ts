/**
 * Icon registry, the single source of truth for iconography.
 *
 * Rules:
 *  1. Lucide is the ONLY icon library in this app. It is a LINE-ART set:
 *     every glyph is an outline stroked at a uniform weight, never a filled
 *     shape. See ICON_STROKE_WIDTH in AppIcon for the weight.
 *  2. One semantic concept resolves to exactly one glyph, everywhere.
 *     "maintenance" looks identical in the sidebar, a table row and a card.
 *  3. Components reference icons by semantic name via <AppIcon name="..." />,
 *     never by importing from lucide-react directly.
 *  4. Named imports only, a wildcard import would pull the whole set into
 *     the bundle.
 */
import {
  // navigation
  LayoutGrid, GitBranch, Users, AlertTriangle, ClipboardList, Cpu, FileText,
  Shield, Home, Menu, PanelLeft, PanelLeftClose, PanelLeftOpen,
  // direction
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  TrendingUp, TrendingDown, ExternalLink,
  // actions
  Search, Download, Upload, Plus, Minus, Pencil, Trash2, Filter, X, Check,
  Play, Pause, RefreshCw, MoreHorizontal, GripVertical, LogOut, FileOutput,
  ListChecks, Ban,
  // system / state
  Bell, Settings, Sun, Moon, Eye, EyeOff, Lock, LockOpen, Circle, CheckCircle2,
  Info, AlertCircle, HelpCircle, Loader2, Clock, History, CalendarDays,
  // security & governance
  ShieldCheck, ShieldAlert, UserCheck, Zap, Wrench, Hammer,
  // healthcare
  Stethoscope, Building2, UserRound, ClipboardPlus, FileHeart,
  // AI
  Bot, Brain,
  // data
  Database, Server, Network, BarChart3, LineChart, PieChart, Activity, Map,
} from "lucide-react";

export const icons = {
  // --- navigation ---------------------------------------------------------
  dashboard: LayoutGrid,
  phiFlow: GitBranch,
  access: Users,
  threats: AlertTriangle,
  policy: ClipboardList,
  ai: Cpu,
  audit: FileText,
  risks: Shield,
  home: Home,
  menu: Menu,
  panel: PanelLeft,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,

  // --- direction ----------------------------------------------------------
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  externalLink: ExternalLink,

  // --- actions ------------------------------------------------------------
  search: Search,
  download: Download,
  upload: Upload,
  add: Plus,
  remove: Minus,
  edit: Pencil,
  delete: Trash2,
  filter: Filter,
  close: X,
  check: Check,
  play: Play,
  pause: Pause,
  refresh: RefreshCw,
  more: MoreHorizontal,
  drag: GripVertical,
  logout: LogOut,
  export: FileOutput,
  tasks: ListChecks,
  block: Ban,

  // --- system / state -----------------------------------------------------
  notification: Bell,
  settings: Settings,
  themeLight: Sun,
  themeDark: Moon,
  visible: Eye,
  hidden: EyeOff,
  locked: Lock,
  unlocked: LockOpen,
  dot: Circle,
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
  help: HelpCircle,
  loading: Loader2,
  clock: Clock,
  history: History,
  calendar: CalendarDays,

  // --- security & governance ---------------------------------------------
  compliance: ShieldCheck,
  threat: ShieldAlert,
  identity: UserCheck,
  incident: Zap,
  maintenance: Wrench,
  remediation: Hammer,

  // --- healthcare ---------------------------------------------------------
  clinical: Stethoscope,
  facility: Building2,
  practitioner: UserRound,
  record: ClipboardPlus,
  document: FileHeart,

  // --- AI -----------------------------------------------------------------
  model: Bot,
  intelligence: Brain,

  // --- data ---------------------------------------------------------------
  database: Database,
  server: Server,
  network: Network,
  chart: BarChart3,
  chartLine: LineChart,
  chartPie: PieChart,
  activity: Activity,
  map: Map,
} as const;

export type IconName = keyof typeof icons;
