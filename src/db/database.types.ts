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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          app_source: string | null
          app_version: string | null
          cancelled: boolean | null
          category_id: string | null
          columns_mapped: number | null
          created_at: string
          detection_method: string | null
          ended_at: string | null
          engine_ended_at: string | null
          engine_started_at: string | null
          error_count: number | null
          error_message: string | null
          event_type: string
          execution_time_ms: number | null
          extension_version: string | null
          field_mode: string | null
          field_selection: string | null
          generated_description: string | null
          generated_title: string | null
          id: string
          import_mode: string | null
          input_rows: number | null
          item_index: number | null
          item_status: string | null
          items_content: Json | null
          output_rows: number | null
          photo_count: number | null
          receipt_number: string | null
          session_id: string | null
          skipped_count: number | null
          started_at: string | null
          success_count: number | null
          total_groups: number | null
          total_items: number | null
          total_photos: number | null
          user_email: string | null
        }
        Insert: {
          app_source?: string | null
          app_version?: string | null
          cancelled?: boolean | null
          category_id?: string | null
          columns_mapped?: number | null
          created_at?: string
          detection_method?: string | null
          ended_at?: string | null
          engine_ended_at?: string | null
          engine_started_at?: string | null
          error_count?: number | null
          error_message?: string | null
          event_type: string
          execution_time_ms?: number | null
          extension_version?: string | null
          field_mode?: string | null
          field_selection?: string | null
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          import_mode?: string | null
          input_rows?: number | null
          item_index?: number | null
          item_status?: string | null
          items_content?: Json | null
          output_rows?: number | null
          photo_count?: number | null
          receipt_number?: string | null
          session_id?: string | null
          skipped_count?: number | null
          started_at?: string | null
          success_count?: number | null
          total_groups?: number | null
          total_items?: number | null
          total_photos?: number | null
          user_email?: string | null
        }
        Update: {
          app_source?: string | null
          app_version?: string | null
          cancelled?: boolean | null
          category_id?: string | null
          columns_mapped?: number | null
          created_at?: string
          detection_method?: string | null
          ended_at?: string | null
          engine_ended_at?: string | null
          engine_started_at?: string | null
          error_count?: number | null
          error_message?: string | null
          event_type?: string
          execution_time_ms?: number | null
          extension_version?: string | null
          field_mode?: string | null
          field_selection?: string | null
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          import_mode?: string | null
          input_rows?: number | null
          item_index?: number | null
          item_status?: string | null
          items_content?: Json | null
          output_rows?: number | null
          photo_count?: number | null
          receipt_number?: string | null
          session_id?: string | null
          skipped_count?: number | null
          started_at?: string | null
          success_count?: number | null
          total_groups?: number | null
          total_items?: number | null
          total_photos?: number | null
          user_email?: string | null
        }
        Relationships: []
      }
      export_history: {
        Row: {
          exported_at: string
          exported_by: string
          id: string
          item_count: number
          session_id: string
          session_mode: string
          session_name: string
        }
        Insert: {
          exported_at?: string
          exported_by: string
          id?: string
          item_count: number
          session_id: string
          session_mode: string
          session_name: string
        }
        Update: {
          exported_at?: string
          exported_by?: string
          id?: string
          item_count?: number
          session_id?: string
          session_mode?: string
          session_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          ai_status: string
          artist_dates: string | null
          artist_first_name: string | null
          artist_last_name: string | null
          artist_origin: string | null
          category: string | null
          condition: string | null
          created_at: string
          description: string | null
          estimate: string | null
          id: string
          measurements: string | null
          medium: string | null
          mode: string
          receipt_number: string | null
          session_id: string
          sort_order: number
          title: string | null
          transcript: string | null
        }
        Insert: {
          ai_status?: string
          artist_dates?: string | null
          artist_first_name?: string | null
          artist_last_name?: string | null
          artist_origin?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          estimate?: string | null
          id?: string
          measurements?: string | null
          medium?: string | null
          mode: string
          receipt_number?: string | null
          session_id: string
          sort_order?: number
          title?: string | null
          transcript?: string | null
        }
        Update: {
          ai_status?: string
          artist_dates?: string | null
          artist_first_name?: string | null
          artist_last_name?: string | null
          artist_origin?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          estimate?: string | null
          id?: string
          measurements?: string | null
          medium?: string | null
          mode?: string
          receipt_number?: string | null
          session_id?: string
          sort_order?: number
          title?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          id: string
          item_id: string
          sort_order: number
          storage_path: string
          thumbnail_path: string
          upload_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          sort_order?: number
          storage_path: string
          thumbnail_path: string
          upload_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          sort_order?: number
          storage_path?: string
          thumbnail_path?: string
          upload_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          role: string
          walkthrough_completed: boolean
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id: string
          is_active?: boolean
          role?: string
          walkthrough_completed?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          role?: string
          walkthrough_completed?: boolean
        }
        Relationships: []
      }
      sessions: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          mode: string
          name: string
          notes: string
          review_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          mode: string
          name: string
          notes?: string
          review_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mode?: string
          name?: string
          notes?: string
          review_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ui_interactions: {
        Row: {
          app_source: string
          app_version: string | null
          created_at: string
          element_id: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          app_source?: string
          app_version?: string | null
          created_at?: string
          element_id?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          app_source?: string
          app_version?: string | null
          created_at?: string
          element_id?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ui_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_sessions: {
        Args: { p_mode?: string; p_specialists?: string[] }
        Returns: {
          assigned_to_display_name: string
          assigned_to_id: string
          created_at: string
          item_count: number
          mode: string
          name: string
          session_id: string
          status: string
          updated_at: string
        }[]
      }
      get_ai_status_distribution: {
        Args: {
          p_from: string
          p_mode?: string
          p_specialists?: string[]
          p_to: string
        }
        Returns: {
          ai_status: string
          item_count: number
        }[]
      }
      get_cancellation_rates: {
        Args: {
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          cancelled_count: number
          event_type: string
          previous_rate: number
          rate: number
          total_count: number
        }[]
      }
      get_dominant_version: {
        Args: {
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          event_count: number
          extension_version: string
        }[]
      }
      get_error_rate_by_type: {
        Args: {
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          errors: number
          event_type: string
          rate: number
          total: number
        }[]
      }
      get_event_volume_daily: {
        Args: {
          p_bucket?: string
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          bucket_start: string
          event_count: number
          event_type: string
        }[]
      }
      get_export_pipeline: {
        Args: {
          p_from: string
          p_mode?: string
          p_specialists?: string[]
          p_to: string
        }
        Returns: {
          session_count: number
          status: string
        }[]
      }
      get_failed_ai_breakdown: {
        Args: {
          p_from: string
          p_mode?: string
          p_specialists?: string[]
          p_to: string
        }
        Returns: {
          dim_key: string
          dim_label: string
          dimension: string
          item_count: number
        }[]
      }
      get_house_sale_split: {
        Args: {
          p_from: string
          p_mode?: string
          p_specialists?: string[]
          p_to: string
        }
        Returns: {
          mode: string
          n_items: number
          n_sessions: number
        }[]
      }
      get_items_per_specialist_14d: {
        Args: { p_mode?: string; p_specialists?: string[] }
        Returns: {
          bucket_start: string
          item_count: number
          specialist_display_name: string
          specialist_email: string
          specialist_id: string
        }[]
      }
      get_kpi_totals: {
        Args: {
          p_bucket?: string
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          current_count: number
          event_type: string
          previous_count: number
          sparkline: Json
        }[]
      }
      get_per_user_summary: {
        Args: {
          p_from: string
          p_to: string
          p_users?: string[]
          p_versions?: string[]
        }
        Returns: {
          catalog_batch: number
          catalog_single: number
          data_import: number
          last_seen_at: string
          portal_upload: number
          spreadsheet_transform: number
          total_errors: number
          user_email_label: string
        }[]
      }
      get_photo_coverage: {
        Args: { p_session_id: string }
        Returns: {
          items_total: number
          items_with_photos: number
          items_without_photos: number
          status_failed: number
          status_pending: number
          status_uploaded: number
          status_uploading: number
        }[]
      }
      get_session_detail: {
        Args: { p_session_id: string }
        Returns: {
          assigned_to_display_name: string
          assigned_to_id: string
          created_at: string
          created_by_display_name: string
          created_by_id: string
          mode: string
          name: string
          notes: string
          review_notes: string
          session_id: string
          status: string
          updated_at: string
        }[]
      }
      get_stuck_items: {
        Args: { p_mode?: string; p_specialists?: string[] }
        Returns: {
          age_seconds: number
          ai_status: string
          category: string
          created_at: string
          estimate: string
          item_id: string
          photo_paths: string[]
          receipt_number: string
          session_id: string
          session_name: string
          specialist_display_name: string
          specialist_id: string
          title: string
        }[]
      }
      get_today_kpis: {
        Args: { p_mode?: string; p_specialists?: string[] }
        Returns: {
          exports_today: number
          exports_yday: number
          items_done_today: number
          items_done_yday: number
          items_today: number
          items_total_today: number
          items_total_yday: number
          items_yday: number
          sessions_today: number
          sessions_yday: number
        }[]
      }
      get_ui_top_elements: {
        Args: { p_from: string; p_to: string }
        Returns: {
          click_count: number
          element_id: string
        }[]
      }
      get_ui_top_pages: {
        Args: { p_from: string; p_to: string }
        Returns: {
          page_path: string
          view_count: number
        }[]
      }
      get_walkthrough_funnel: {
        Args: never
        Returns: {
          distinct_users: number
          step_name: string
          step_order: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
