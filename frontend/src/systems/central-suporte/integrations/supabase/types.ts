export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          ticket_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          ticket_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          ticket_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          default_assignee_id: string | null
          default_priority: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          default_assignee_id?: string | null
          default_priority?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          default_assignee_id?: string | null
          default_priority?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      category_sectors: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          sector_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          sector_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_sectors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          internal_only: boolean | null
          ticket_id: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          internal_only?: boolean | null
          ticket_id?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          internal_only?: boolean | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          severity: Database["public"]["Enums"]["ticket_priority"] | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["ticket_priority"] | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["ticket_priority"] | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kb_articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_sounds: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          file_path: string
          id: string
          is_active: boolean
          name: string
          sound_type: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          file_path: string
          id?: string
          is_active?: boolean
          name: string
          sound_type: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          file_path?: string
          id?: string
          is_active?: boolean
          name?: string
          sound_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_sounds_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          ticket_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          ticket_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          ticket_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      remote_access_devices: {
        Row: {
          anydesk_id: string
          anydesk_password: string
          created_at: string | null
          created_by: string | null
          id: string
          machine_name: string
          updated_at: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          anydesk_id: string
          anydesk_password: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          machine_name: string
          updated_at?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          anydesk_id?: string
          anydesk_password?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          machine_name?: string
          updated_at?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "remote_access_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remote_access_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_hours: number
          response_time_hours: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_hours: number
          response_time_hours: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_hours?: number
          response_time_hours?: number
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string | null
          created_at: string | null
          default_assignee_id: string | null
          default_priority: string | null
          id: string
          name: string
          requires_approval: boolean | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          default_assignee_id?: string | null
          default_priority?: string | null
          id?: string
          name: string
          requires_approval?: boolean | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          default_assignee_id?: string | null
          default_priority?: string | null
          id?: string
          name?: string
          requires_approval?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          task_instance_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_instance_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_instance_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          assignee_id: string | null
          checklist: Json | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          status: string
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          assignee_id: string | null
          checklist_items: Json | null
          created_at: string | null
          created_by: string | null
          day_of_week: number[]
          description: string | null
          id: string
          is_active: boolean | null
          scheduled_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          checklist_items?: Json | null
          created_at?: string | null
          created_by?: string | null
          day_of_week: number[]
          description?: string | null
          id?: string
          is_active?: boolean | null
          scheduled_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          checklist_items?: Json | null
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number[]
          description?: string | null
          id?: string
          is_active?: boolean | null
          scheduled_time?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assignee_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          incident_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id: string | null
          resolved_at: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id: string | null
          target_sector_id: string | null
          ticket_code: number
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assignee_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          incident_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id?: string | null
          target_sector_id?: string | null
          ticket_code?: number
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assignee_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          incident_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id?: string | null
          target_sector_id?: string | null
          ticket_code?: number
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_target_sector_id_fkey"
            columns: ["target_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_pre_register_support_user: {
        Args: {
          _email: string
          _full_name: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _sector_id: string
        }
        Returns: undefined
      }
      ensure_support_user_profile: { Args: never; Returns: undefined }
      archive_ticket: {
        Args: { _reason: string; _ticket_id: string }
        Returns: undefined
      }
      admin_update_user_profile_and_roles: {
        Args: {
          _department: string
          _full_name: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: undefined
      }
      check_sla_breaches: { Args: never; Returns: undefined }
      create_scheduled_tasks: { Args: never; Returns: undefined }
      get_coordinator_sector_name: {
        Args: { _user_id: string }
        Returns: string
      }
      get_ticket_metrics:
        | {
            Args: { _days?: number }
            Returns: {
              avg_resolution_hours: number
              avg_response_hours: number
              overdue_resolution: number
              overdue_response: number
            }[]
          }
        | {
            Args: { _days?: number; _sector_id?: string }
            Returns: {
              avg_resolution_hours: number
              avg_response_hours: number
              overdue_resolution: number
              overdue_response: number
            }[]
          }
      get_user_sector_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coordinator: { Args: { _user_id: string }; Returns: boolean }
      is_direction: { Args: { _user_id: string }; Returns: boolean }
      restore_ticket: {
        Args: { _reason: string; _ticket_id: string }
        Returns: undefined
      }
      transfer_ticket: {
        Args: { _new_assignee_id: string; _ticket_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "user"
        | "support_agent"
        | "dev"
        | "admin_ti"
        | "coordinator"
        | "viewer"
        | "coordinator_sp"
        | "coordinator_sc"
        | "coordinator_sf"
        | "coordinator_fn"
        | "coordinator_rh"
        | "direction"
        | "dp"
        | "fiscal"
        | "contabil"
        | "financeiro"
        | "societario"
        | "recepcao"
        | "rh"
      ticket_priority: "p0" | "p1" | "p2" | "p3"
      ticket_status:
        | "new"
        | "open"
        | "pending"
        | "parado"
        | "testing"
        | "resolved"
        | "closed"
        | "canceled"
      ticket_type: "incident" | "request"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "user",
        "support_agent",
        "dev",
        "admin_ti",
        "coordinator",
        "viewer",
        "coordinator_sp",
        "coordinator_sc",
        "coordinator_sf",
        "coordinator_fn",
        "coordinator_rh",
        "direction",
        "dp",
        "fiscal",
        "contabil",
        "financeiro",
        "societario",
        "recepcao",
        "rh",
      ],
      ticket_priority: ["p0", "p1", "p2", "p3"],
      ticket_status: [
        "new",
        "open",
        "pending",
        "parado",
        "testing",
        "resolved",
        "closed",
        "canceled",
      ],
      ticket_type: ["incident", "request"],
    },
  },
} as const

