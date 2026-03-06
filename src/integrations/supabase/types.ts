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
      funds: {
        Row: {
          amc_name: string
          asset_class: string | null
          category: string | null
          created_at: string
          currency: string
          fund_code: string
          fund_name: string
          id: string
          is_active: boolean
          risk_level: number | null
          updated_at: string
        }
        Insert: {
          amc_name: string
          asset_class?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          fund_code: string
          fund_name: string
          id?: string
          is_active?: boolean
          risk_level?: number | null
          updated_at?: string
        }
        Update: {
          amc_name?: string
          asset_class?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          fund_code?: string
          fund_name?: string
          id?: string
          is_active?: boolean
          risk_level?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      nav_history: {
        Row: {
          fetched_at: string | null
          fund_id: string
          id: string
          nav_date: string
          nav_per_unit: number
          source: string | null
          updated_at: string
        }
        Insert: {
          fetched_at?: string | null
          fund_id: string
          id?: string
          nav_date: string
          nav_per_unit: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          fetched_at?: string | null
          fund_id?: string
          id?: string
          nav_date?: string
          nav_per_unit?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nav_history_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          id: string
          latest_nav_date: string | null
          snapshot_date: string
          total_cost: number
          total_gain_loss: number
          total_return_percent: number
          total_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          latest_nav_date?: string | null
          snapshot_date: string
          total_cost: number
          total_gain_loss: number
          total_return_percent: number
          total_value: number
        }
        Update: {
          created_at?: string
          id?: string
          latest_nav_date?: string | null
          snapshot_date?: string
          total_cost?: number
          total_gain_loss?: number
          total_return_percent?: number
          total_value?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          dividend_type: Database["public"]["Enums"]["dividend_type"] | null
          fee: number
          fund_id: string
          id: string
          nav_at_trade: number
          note: string | null
          trade_date: string
          tx_type: Database["public"]["Enums"]["tx_type"]
          units: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          dividend_type?: Database["public"]["Enums"]["dividend_type"] | null
          fee?: number
          fund_id: string
          id?: string
          nav_at_trade: number
          note?: string | null
          trade_date: string
          tx_type: Database["public"]["Enums"]["tx_type"]
          units: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          dividend_type?: Database["public"]["Enums"]["dividend_type"] | null
          fee?: number
          fund_id?: string
          id?: string
          nav_at_trade?: number
          note?: string | null
          trade_date?: string
          tx_type?: Database["public"]["Enums"]["tx_type"]
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dividend_type: "cash" | "reinvest"
      tx_type: "buy" | "sell" | "dividend" | "switch_in" | "switch_out"
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
      dividend_type: ["cash", "reinvest"],
      tx_type: ["buy", "sell", "dividend", "switch_in", "switch_out"],
    },
  },
} as const
