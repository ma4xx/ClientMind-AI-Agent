'use client';

import { Cpu, Database, Search, Zap } from 'lucide-react';

import { LazyImage } from '@/shared/blocks/common';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

const iconMap: Record<string, any> = {
  search: Search,
  database: Database,
  zap: Zap,
  cpu: Cpu,
};

export function Logos({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-12 md:py-20', section.className, className)}
    >
      <div className={`mx-auto max-w-5xl px-6`}>
        <ScrollAnimation>
          <p className="text-muted-foreground text-center text-sm font-medium tracking-wider uppercase">
            {section.title}
          </p>
        </ScrollAnimation>
        <ScrollAnimation delay={0.2}>
          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-4 md:gap-8">
            {section.items?.map((item, idx) => {
              const IconComponent = item.icon ? iconMap[item.icon as string] : null;

              return (
                <div
                  key={idx}
                  className="bg-secondary/30 border-border/50 hover:border-primary/50 flex items-center gap-3 rounded-full border px-5 py-2 transition-colors duration-300"
                >
                  {item.image?.src ? (
                    <LazyImage
                      className="h-5 w-fit dark:invert"
                      src={item.image.src}
                      alt={item.image.alt ?? item.title ?? ''}
                    />
                  ) : IconComponent ? (
                    <IconComponent className="text-primary h-4 w-4" />
                  ) : (
                    <div className="bg-primary/20 h-2 w-2 rounded-full" />
                  )}
                  <span className="text-sm font-semibold tracking-tight">
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
