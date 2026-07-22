import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@suporte/components/ui/badge";
import { KanbanTicketCard } from "./KanbanTicketCard";
import { KanbanTaskCard } from "./KanbanTaskCard";
import { SlaInfo } from "@suporte/hooks/useSlaStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";

const CARDS_PER_PAGE = 9;

type ColumnId = "tasks" | "open" | "pending" | "testing" | "resolved";

interface ColumnDef {
  id: ColumnId;
  label: string;
  color: string;
  borderColor: string;
  badgeClass: string;
}

interface ViewerCarouselProps {
  columns: Record<ColumnId, any[]>;
  columnConfig: ColumnDef[];
  slaMap: Record<string, SlaInfo>;
  onTicketClick: (id: string) => void;
  onTaskClick: (id: string) => void;
  onNewTicket: () => void;
}

type Slide =
  | { type: "overview" }
  | { type: "status"; columnId: ColumnId; page: number; totalPages: number };

function buildSlides(columns: Record<ColumnId, any[]>): Slide[] {
  const slides: Slide[] = [{ type: "overview" }];

  const statusOrder: ColumnId[] = ["tasks", "open", "pending", "testing", "resolved"];
  for (const colId of statusOrder) {
    const items = columns[colId];
    const totalPages = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
    for (let page = 0; page < totalPages; page++) {
      slides.push({ type: "status", columnId: colId, page, totalPages });
    }
  }

  return slides;
}

export function ViewerCarousel({
  columns: rawColumns,
  columnConfig,
  slaMap,
  onTicketClick,
  onTaskClick,
  onNewTicket,
}: ViewerCarouselProps) {
  // Filter resolved column: only show items from today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const columns = {
    ...rawColumns,
    resolved: rawColumns.resolved.filter((item: any) => {
      const date = item._isTask
        ? item.completed_at ? new Date(item.completed_at) : new Date(item.created_at)
        : new Date(item.updated_at || item.created_at);
      return date >= todayStart;
    }),
  };
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slides = buildSlides(columns);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch carousel duration from settings
  const { data: settingsData } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "carousel_slide_duration")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const slideDurationMs = (parseInt(settingsData?.value || "30", 10)) * 1000;

  const resetToOverview = useCallback(() => {
    setCurrentSlideIndex(0);
  }, []);

  // Expose reset callback
  useEffect(() => {
    (window as any).__viewerCarouselReset = resetToOverview;
    return () => {
      delete (window as any).__viewerCarouselReset;
    };
  }, [resetToOverview]);

  // Auto-advance timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentSlideIndex((prev) => {
        const nextSlides = buildSlides(columns);
        return (prev + 1) % nextSlides.length;
      });
    }, slideDurationMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [columns, slideDurationMs]);

  // Ensure slide index stays in bounds
  const safeIndex = currentSlideIndex % slides.length;
  const currentSlide = slides[safeIndex];

  const getColConfig = (colId: ColumnId) =>
    columnConfig.find((c) => c.id === colId)!;

  // Progress indicator
  const progressPercent = ((safeIndex + 1) / slides.length) * 100;

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Chamados</h2>
          <p className="text-muted-foreground text-sm">
            {currentSlide.type === "overview"
              ? "Visão geral"
              : `${getColConfig(currentSlide.columnId).label} — Página ${currentSlide.page + 1} de ${currentSlide.totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all ${
                i === safeIndex ? "bg-primary scale-125" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <ProgressTimer
          key={safeIndex}
          durationMs={slideDurationMs}
        />
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-hidden animate-fade-in" key={safeIndex}>
        {currentSlide.type === "overview" ? (
          <OverviewSlide
            columns={columns}
            columnConfig={columnConfig}
            slaMap={slaMap}
            onTicketClick={onTicketClick}
            onTaskClick={onTaskClick}
          />
        ) : (
          <StatusSlide
            items={columns[currentSlide.columnId]}
            page={currentSlide.page}
            colConfig={getColConfig(currentSlide.columnId)}
            slaMap={slaMap}
            onTicketClick={onTicketClick}
            onTaskClick={onTaskClick}
          />
        )}
      </div>
    </div>
  );
}

/** Animated progress bar that fills over durationMs */
function ProgressTimer({ durationMs }: { durationMs: number }) {
  return (
    <div
      className="h-full bg-primary transition-none"
      style={{
        width: "0%",
        animation: `progress-fill ${durationMs}ms linear forwards`,
      }}
    />
  );
}

/** Full kanban overview - all 3 columns */
function OverviewSlide({
  columns,
  columnConfig,
  slaMap,
  onTicketClick,
  onTaskClick,
}: {
  columns: Record<ColumnId, any[]>;
  columnConfig: ColumnDef[];
  slaMap: Record<string, SlaInfo>;
  onTicketClick: (id: string) => void;
  onTaskClick: (id: string) => void;
}) {
  return (
    <div className="flex gap-4 h-full">
      {columnConfig.map((col) => {
        const items = columns[col.id];
        return (
          <div key={col.id} className="flex-1 min-w-0 flex flex-col gap-3">
            <div className={`flex items-center justify-between p-2 rounded-lg border ${col.color}`}>
              <span className="font-semibold">{col.label}</span>
              <Badge className={col.badgeClass} variant={col.badgeClass ? undefined : "secondary"}>
                {items.length}
              </Badge>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {items.map((item: any) =>
                item._isTask ? (
                  <KanbanTaskCard
                    key={item.id}
                    task={item}
                    columnId={col.id}
                    isDragging={false}
                    onClick={() => onTaskClick(item.id)}
                  />
                ) : (
                  <KanbanTicketCard
                    key={item.id}
                    ticket={item}
                    columnId={col.id}
                    borderColor={col.borderColor}
                    isDragging={false}
                    slaInfo={slaMap[item.id]}
                    onClick={() => onTicketClick(item.id)}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Single status page with 3-column card grid */
function StatusSlide({
  items,
  page,
  colConfig,
  slaMap,
  onTicketClick,
  onTaskClick,
}: {
  items: any[];
  page: number;
  colConfig: ColumnDef;
  slaMap: Record<string, SlaInfo>;
  onTicketClick: (id: string) => void;
  onTaskClick: (id: string) => void;
}) {
  const pageItems = items.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className={`flex items-center justify-between p-3 rounded-lg border ${colConfig.color}`}>
        <span className="font-bold text-xl">{colConfig.label}</span>
        <Badge className={colConfig.badgeClass} variant={colConfig.badgeClass ? undefined : "secondary"}>
          {items.length} total
        </Badge>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-4 auto-rows-min content-start">
        {pageItems.map((item: any) =>
          item._isTask ? (
            <KanbanTaskCard
              key={item.id}
              task={item}
              columnId={colConfig.id}
              isDragging={false}
              onClick={() => onTaskClick(item.id)}
            />
          ) : (
            <KanbanTicketCard
              key={item.id}
              ticket={item}
              columnId={colConfig.id}
              borderColor={colConfig.borderColor}
              isDragging={false}
              slaInfo={slaMap[item.id]}
              onClick={() => onTicketClick(item.id)}
            />
          )
        )}
        {pageItems.length === 0 && (
          <p className="col-span-3 text-center text-muted-foreground py-12">
            Nenhum chamado nesta categoria
          </p>
        )}
      </div>
    </div>
  );
}

