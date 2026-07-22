import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@suporte/components/ui/card";
import { Button } from "@suporte/components/ui/button";
import { Badge } from "@suporte/components/ui/badge";
import { Separator } from "@suporte/components/ui/separator";
import { Slider } from "@suporte/components/ui/slider";
import { Switch } from "@suporte/components/ui/switch";
import { Label } from "@suporte/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@suporte/components/ui/select";
import {
  Volume2, Upload, Trash2, Play, Check, Monitor, Bell, BellOff, UserCheck, VolumeX, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { clearSoundCache } from "@suporte/lib/notification-sound";
import { clearBrowserNotifCache } from "@suporte/hooks/useBrowserNotifications";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type SoundType = "ticket_opened" | "ticket_closed" | "assignee";

export function DisplaySoundTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<SoundType>("ticket_opened");
  const [uploadAssigneeId, setUploadAssigneeId] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch carousel duration setting
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  // Fetch notification sounds
  const { data: sounds } = useQuery({
    queryKey: ["notification-sounds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_sounds")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff profiles for assignee sound mapping
  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-sounds"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["support_agent", "dev", "admin_ti", "coordinator"]);
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];
      const uniqueIds = [...new Set(roles.map(r => r.user_id))];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uniqueIds);
      if (error) throw error;
      return data || [];
    },
  });

  const carouselDuration = parseInt(settings?.carousel_slide_duration || "30", 10);
  

  // Sound enabled toggles (default true if not set)
  const soundToggles = {
    sound_ticket_opened: settings?.sound_ticket_opened !== "false",
    sound_ticket_closed: settings?.sound_ticket_closed !== "false",
    sound_assignee: settings?.sound_assignee !== "false",
    browser_notifications: settings?.browser_notifications !== "false",
  };

  // Update carousel duration
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["siren-config"] });
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  // Upload a sound file
  const uploadSound = useMutation({
    mutationFn: async ({ file, type, assigneeId }: { file: File; type: SoundType; assigneeId?: string }) => {
      const folder = type === "assignee" ? `assignee/${assigneeId}` : type;
      const filePath = `${folder}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("notification-sounds")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const insertData: any = {
        name: file.name.replace(/\.[^.]+$/, ""),
        file_path: filePath,
        sound_type: type,
        is_active: false,
      };
      if (type === "assignee" && assigneeId) {
        insertData.assignee_id = assigneeId;
      }

      const { error } = await supabase.from("notification_sounds").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
      clearSoundCache();
      toast.success("Toque enviado com sucesso");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => toast.error("Erro ao enviar toque"),
  });

  // Delete a sound
  const deleteSound = useMutation({
    mutationFn: async (sound: any) => {
      await supabase.storage.from("notification-sounds").remove([sound.file_path]);
      const { error } = await supabase.from("notification_sounds").delete().eq("id", sound.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
      clearSoundCache();
      toast.success("Toque removido");
    },
    onError: () => toast.error("Erro ao remover toque"),
  });

  // Set active sound
  const setActiveSound = useMutation({
    mutationFn: async ({ soundId, type, assigneeId }: { soundId: string; type: SoundType; assigneeId?: string }) => {
      if (type === "assignee" && assigneeId) {
        // Deactivate all sounds for this assignee
        await supabase
          .from("notification_sounds")
          .update({ is_active: false })
          .eq("sound_type", "assignee")
          .eq("assignee_id", assigneeId);
      } else {
        // Deactivate all of this type
        await supabase
          .from("notification_sounds")
          .update({ is_active: false })
          .eq("sound_type", type);
      }
      // Activate selected
      const { error } = await supabase
        .from("notification_sounds")
        .update({ is_active: true })
        .eq("id", soundId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
      clearSoundCache();
      toast.success("Toque ativado");
    },
    onError: () => toast.error("Erro ao ativar toque"),
  });

  // Deactivate all sounds of a type (use default)
  const useDefaultSound = useMutation({
    mutationFn: async ({ type, assigneeId }: { type: SoundType; assigneeId?: string }) => {
      let query = supabase
        .from("notification_sounds")
        .update({ is_active: false })
        .eq("sound_type", type);
      if (type === "assignee" && assigneeId) {
        query = query.eq("assignee_id", assigneeId);
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
      clearSoundCache();
      toast.success("Usando toque padrão do sistema");
    },
  });

  const playSound = (filePath: string) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/notification-sounds/${filePath}`;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => toast.error("Não foi possível reproduzir o áudio"));
  };

  const handleFileUpload = (type: SoundType, assigneeId?: string) => {
    setUploadType(type);
    setUploadAssigneeId(assigneeId || "");
    fileInputRef.current?.click();
  };

  const openedSounds = sounds?.filter(s => s.sound_type === "ticket_opened") || [];
  const closedSounds = sounds?.filter(s => s.sound_type === "ticket_closed") || [];
  const assigneeSounds = sounds?.filter(s => s.sound_type === "assignee") || [];
  const activeOpened = openedSounds.find(s => s.is_active);
  const activeClosed = closedSounds.find(s => s.is_active);

  // State for selected assignee in the assignee sounds section
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  const staffAssigneeSounds = selectedStaffId
    ? assigneeSounds.filter(s => s.assignee_id === selectedStaffId)
    : [];
  const activeAssigneeSound = staffAssigneeSounds.find(s => s.is_active);

  return (
    <div className="space-y-6">
      {/* Carousel Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5" />
            Tempo de Transição do Painel (TV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define o tempo (em segundos) que cada tela do carrossel fica visível antes de avançar.
          </p>
          <div className="flex items-center gap-4">
            <Slider
              value={[carouselDuration]}
              onValueChange={([v]) => {
                updateSetting.mutate({ key: "carousel_slide_duration", value: String(v) });
                toast.success("Tempo de transição atualizado");
              }}
              min={5}
              max={120}
              step={5}
              className="flex-1"
            />
            <span className="text-lg font-bold w-16 text-center">{carouselDuration}s</span>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>5s</span>
            <span className="flex-1" />
            <span>120s</span>
          </div>
        </CardContent>
      </Card>

      {/* Sound Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <VolumeX className="h-5 w-5" />
            Ativar / Desativar Sons
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Desative tipos de notificação sonora individualmente. Quando desativado, nenhum som será reproduzido para aquele evento.
          </p>

          {([
            { key: "sound_ticket_opened", label: "Som de Chamado Aberto", icon: <Bell className="h-4 w-4" /> },
            { key: "sound_ticket_closed", label: "Som de Chamado Finalizado", icon: <BellOff className="h-4 w-4" /> },
            { key: "sound_assignee", label: "Som por Responsável", icon: <UserCheck className="h-4 w-4" /> },
            { key: "browser_notifications", label: "Notificações no Navegador", icon: <Globe className="h-4 w-4" /> },
          ] as { key: keyof typeof soundToggles; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {icon}
                <Label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</Label>
              </div>
              <Switch
                id={key}
                checked={soundToggles[key]}
                onCheckedChange={(checked) => {
                  updateSetting.mutate({ key, value: String(checked) });
                  clearSoundCache();
                  clearBrowserNotifCache();
                  toast.success(`${label} ${checked ? "ativado" : "desativado"}`);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>


      {/* Notification Sounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Volume2 className="h-5 w-5" />
            Sons de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Arquivo deve ter no máximo 5MB");
                  return;
                }
                uploadSound.mutate({
                  file,
                  type: uploadType,
                  assigneeId: uploadType === "assignee" ? uploadAssigneeId : undefined,
                });
              }
            }}
          />

          {/* Ticket Opened Sounds */}
          <SoundSection
            title="Chamado Aberto"
            icon={<Bell className="h-4 w-4" />}
            sounds={openedSounds}
            activeSound={activeOpened}
            onPlay={playSound}
            onSetActive={(id) => setActiveSound.mutate({ soundId: id, type: "ticket_opened" })}
            onDelete={(s) => deleteSound.mutate(s)}
            onUpload={() => handleFileUpload("ticket_opened")}
            onUseDefault={() => useDefaultSound.mutate({ type: "ticket_opened" })}
            isUploading={uploadSound.isPending}
          />

          <Separator />

          {/* Ticket Closed Sounds */}
          <SoundSection
            title="Chamado Finalizado"
            icon={<BellOff className="h-4 w-4" />}
            sounds={closedSounds}
            activeSound={activeClosed}
            onPlay={playSound}
            onSetActive={(id) => setActiveSound.mutate({ soundId: id, type: "ticket_closed" })}
            onDelete={(s) => deleteSound.mutate(s)}
            onUpload={() => handleFileUpload("ticket_closed")}
            onUseDefault={() => useDefaultSound.mutate({ type: "ticket_closed" })}
            isUploading={uploadSound.isPending}
          />
        </CardContent>
      </Card>

      {/* Per-Assignee Sounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5" />
            Sons por Responsável
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina toques diferentes para cada responsável. O som toca quando o membro é atribuído a um chamado (manual ou automaticamente).
          </p>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Selecione o responsável</label>
            <Select value={selectedStaffId || "none"} onValueChange={(v) => setSelectedStaffId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full max-w-[300px]">
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {staffProfiles?.map((p) => {
                  const hasSound = assigneeSounds.some(s => s.assignee_id === p.id && s.is_active);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.full_name || p.email}
                        {hasSound && <span className="text-primary">♪</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedStaffId ? (
            <SoundSection
              title={staffProfiles?.find(p => p.id === selectedStaffId)?.full_name || "Responsável"}
              icon={<UserCheck className="h-4 w-4" />}
              sounds={staffAssigneeSounds}
              activeSound={activeAssigneeSound}
              onPlay={playSound}
              onSetActive={(id) => setActiveSound.mutate({ soundId: id, type: "assignee", assigneeId: selectedStaffId })}
              onDelete={(s) => deleteSound.mutate(s)}
              onUpload={() => handleFileUpload("assignee", selectedStaffId)}
              onUseDefault={() => useDefaultSound.mutate({ type: "assignee", assigneeId: selectedStaffId })}
              isUploading={uploadSound.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
              Selecione um responsável acima para configurar o toque.
            </p>
          )}

          {/* Summary of configured assignees */}
          {staffProfiles && staffProfiles.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Resumo de toques configurados</h4>
              <div className="flex flex-wrap gap-2">
                {staffProfiles.map(p => {
                  const active = assigneeSounds.find(s => s.assignee_id === p.id && s.is_active);
                  return (
                    <Badge
                      key={p.id}
                      variant={active ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${active ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                      onClick={() => setSelectedStaffId(p.id)}
                    >
                      {p.full_name?.split(" ")[0] || p.email?.split("@")[0]}
                      {active ? ` ♪ ${active.name}` : " — padrão"}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SoundSection({
  title,
  icon,
  sounds,
  activeSound,
  onPlay,
  onSetActive,
  onDelete,
  onUpload,
  onUseDefault,
  isUploading,
}: {
  title: string;
  icon: React.ReactNode;
  sounds: any[];
  activeSound: any;
  onPlay: (path: string) => void;
  onSetActive: (id: string) => void;
  onDelete: (sound: any) => void;
  onUpload: () => void;
  onUseDefault: () => void;
  isUploading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          {icon} {title}
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onUseDefault}>
            Usar padrão
          </Button>
          <Button variant="outline" size="sm" onClick={onUpload} disabled={isUploading}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            {isUploading ? "Enviando..." : "Enviar toque"}
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Ativo: <strong>{activeSound ? activeSound.name : "Padrão do sistema"}</strong>
      </div>

      {sounds.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg bg-muted/30">
          Nenhum toque personalizado. O som padrão será utilizado.
        </p>
      ) : (
        <div className="space-y-2">
          {sounds.map((sound) => (
            <div
              key={sound.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                sound.is_active ? "border-primary bg-primary/5" : "bg-muted/30"
              }`}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onPlay(sound.file_path)}
              >
                <Play className="h-4 w-4" />
              </Button>
              <span className="text-sm flex-1 truncate">{sound.name}</span>
              {sound.is_active ? (
                <Badge className="bg-primary/20 text-primary shrink-0">
                  <Check className="h-3 w-3 mr-1" /> Ativo
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onSetActive(sound.id)}
                >
                  Ativar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => onDelete(sound)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

