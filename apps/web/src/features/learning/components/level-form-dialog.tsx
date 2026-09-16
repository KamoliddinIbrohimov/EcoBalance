'use client';

import {
  createEducationLevelItemSchema,
  type CreateEducationLevelItemInput,
  type EducationLevelItemDto,
} from '@eco/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Award,
  Baby,
  Backpack,
  Bike,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Cat,
  CircuitBoard,
  Cloud,
  Code,
  Compass,
  Cpu,
  Droplet,
  Dumbbell,
  Feather,
  FlaskConical,
  Flower2,
  Gamepad2,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  Landmark,
  Languages,
  Leaf,
  Library,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Medal,
  Microscope,
  MoreHorizontal,
  Mountain,
  MousePointer2,
  Music,
  Newspaper,
  Palette,
  Paperclip,
  PenTool,
  PawPrint,
  Puzzle,
  Rocket,
  School,
  Scroll,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Telescope,
  TreeDeciduous,
  Trees,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateEducationLevel,
  useEducationLevels,
  useUpdateEducationLevel,
} from '@/features/learning/hooks/use-education-levels';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/cn';
import { makeSlug } from '@/shared/lib/slug';
import type { ApiError } from '@/shared/lib/api-client';

const ICON_OPTIONS: Array<{ name: string; Icon: LucideIcon }> = [
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'Baby', Icon: Baby },
  { name: 'School', Icon: School },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'BookMarked', Icon: BookMarked },
  { name: 'Library', Icon: Library },
  { name: 'Scroll', Icon: Scroll },
  { name: 'PenTool', Icon: PenTool },
  { name: 'Backpack', Icon: Backpack },
  { name: 'Landmark', Icon: Landmark },
  { name: 'Users', Icon: Users },
  { name: 'Building2', Icon: Building2 },
  { name: 'Newspaper', Icon: Newspaper },
  { name: 'Leaf', Icon: Leaf },
  { name: 'Trees', Icon: Trees },
  { name: 'TreeDeciduous', Icon: TreeDeciduous },
  { name: 'Flower2', Icon: Flower2 },
  { name: 'Feather', Icon: Feather },
  { name: 'PawPrint', Icon: PawPrint },
  { name: 'Cat', Icon: Cat },
  { name: 'Mountain', Icon: Mountain },
  { name: 'Droplet', Icon: Droplet },
  { name: 'Sun', Icon: Sun },
  { name: 'Cloud', Icon: Cloud },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Star', Icon: Star },
  { name: 'Lightbulb', Icon: Lightbulb },
  { name: 'Rocket', Icon: Rocket },
  { name: 'Telescope', Icon: Telescope },
  { name: 'Microscope', Icon: Microscope },
  { name: 'FlaskConical', Icon: FlaskConical },
  { name: 'Brain', Icon: Brain },
  { name: 'Cpu', Icon: Cpu },
  { name: 'CircuitBoard', Icon: CircuitBoard },
  { name: 'Code', Icon: Code },
  { name: 'Palette', Icon: Palette },
  { name: 'Music', Icon: Music },
  { name: 'Headphones', Icon: Headphones },
  { name: 'Languages', Icon: Languages },
  { name: 'MapIcon', Icon: MapIcon },
  { name: 'Compass', Icon: Compass },
  { name: 'Trophy', Icon: Trophy },
  { name: 'Medal', Icon: Medal },
  { name: 'Award', Icon: Award },
  { name: 'Target', Icon: Target },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'Heart', Icon: Heart },
  { name: 'Gamepad2', Icon: Gamepad2 },
  { name: 'Puzzle', Icon: Puzzle },
  { name: 'Bike', Icon: Bike },
  { name: 'Dumbbell', Icon: Dumbbell },
  { name: 'Hammer', Icon: Hammer },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Paperclip', Icon: Paperclip },
  { name: 'MousePointer2', Icon: MousePointer2 },
  { name: 'MoreHorizontal', Icon: MoreHorizontal },
];

const ICON_BY_NAME = new Map(ICON_OPTIONS.map((o) => [o.name, o]));

interface LevelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level?: EducationLevelItemDto | null;
}

export function LevelFormDialog({ open, onOpenChange, level }: LevelFormDialogProps) {
  const isEdit = !!level;
  const create = useCreateEducationLevel();
  const update = useUpdateEducationLevel();
  const { data: existingLevels } = useEducationLevels();
  const pending = create.isPending || update.isPending;

  // Yangi darajada: mavjud eng katta tartib + 1 (foydalanuvchi ko'rmaydi, yashirin)
  const nextOrderIndex = (existingLevels ?? []).reduce(
    (max, l) => (l.orderIndex > max ? l.orderIndex : max),
    0,
  ) + 1;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateEducationLevelItemInput>({
    resolver: zodResolver(createEducationLevelItemSchema),
    defaultValues: {
      slug: '',
      nameUz: '',
      descriptionUz: '',
      iconName: 'GraduationCap',
      orderIndex: 0,
      linkedEnum: null,
    },
  });

  const watchedName = watch('nameUz');
  const watchedIcon = watch('iconName');

  useEffect(() => {
    if (!open) return;
    reset({
      slug: level?.slug ?? '',
      nameUz: level?.nameUz ?? '',
      descriptionUz: level?.descriptionUz ?? '',
      iconName: level?.iconName ?? 'GraduationCap',
      orderIndex: level?.orderIndex ?? nextOrderIndex,
      linkedEnum: level?.linkedEnum ?? null,
    });
  }, [open, level, reset, nextOrderIndex]);

  // Yangi daraja: nomdan slug'ni avtomatik generatsiya qilamiz.
  useEffect(() => {
    if (isEdit) return;
    setValue('slug', makeSlug(watchedName ?? ''));
  }, [watchedName, isEdit, setValue]);

  const err = (create.error ?? update.error) as ApiError | undefined;

  const onSubmit = handleSubmit((values) => {
    const payload: CreateEducationLevelItemInput = {
      ...values,
      // Yangi darajada tartib avtomatik keyingi qiymatga o'rnatiladi.
      orderIndex: isEdit ? values.orderIndex : nextOrderIndex,
      descriptionUz: values.descriptionUz?.trim() || null,
    };
    if (isEdit && level) {
      update.mutate(
        {
          id: level.id,
          input: {
            nameUz: payload.nameUz,
            descriptionUz: payload.descriptionUz,
            iconName: payload.iconName,
            linkedEnum: payload.linkedEnum,
          },
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  const CurrentIcon = ICON_BY_NAME.get(watchedIcon)?.Icon ?? GraduationCap;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Darajani tahrirlash' : 'Yangi ta‘lim darajasi'}</DialogTitle>
        </DialogHeader>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err.message}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="level-name">Nomi</Label>
            <Input id="level-name" placeholder="Masalan: Kollej" {...register('nameUz')} />
            {errors.nameUz ? (
              <p className="text-xs font-medium text-destructive">{errors.nameUz.message}</p>
            ) : null}
            {!isEdit && watch('slug') ? (
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">/learning/level/{watch('slug')}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="level-desc">Tavsif (ixtiyoriy)</Label>
            <textarea
              id="level-desc"
              rows={2}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              {...register('descriptionUz')}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Ikon</Label>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CurrentIcon className="h-4 w-4" />
              </span>
            </div>
            <div
              role="listbox"
              aria-label="Ikon tanlash"
              className="grid max-h-[280px] grid-cols-8 gap-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3 eco-scroll"
            >
              {ICON_OPTIONS.map((opt) => {
                const Icon = opt.Icon;
                const selected = watchedIcon === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setValue('iconName', opt.name, { shouldDirty: true })}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-lg border transition-all',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                        : 'border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-primary hover:shadow-sm',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Saqlash' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
