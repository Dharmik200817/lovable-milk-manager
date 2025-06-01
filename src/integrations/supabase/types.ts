export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customer_balances: {
        Row: {
          customer_id: string
          id: string
          pending_amount: number
          updated_at: string
        }
        Insert: {
          customer_id: string
          id?: string
          pending_amount?: number
          updated_at?: string
        }
        Update: {
          customer_id?: string
          id?: string
          pending_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_balances_view"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      delivery_records: {
        Row: {
          created_at: string
          customer_id: string
          delivery_date: string
          id: string
          milk_type_id: string
          notes: string | null
          price_per_liter: number
          quantity: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_date: string
          id?: string
          milk_type_id: string
          notes?: string | null
          price_per_liter: number
          quantity: number
          total_amount: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_date?: string
          id?: string
          milk_type_id?: string
          notes?: string | null
          price_per_liter?: number
          quantity?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances_view"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "delivery_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_records_milk_type_id_fkey"
            columns: ["milk_type_id"]
            isOneToOne: false
            referencedRelation: "milk_types"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_items: {
        Row: {
          created_at: string
          delivery_record_id: string | null
          description: string | null
          id: string
          name: string
          price: number
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          delivery_record_id?: string | null
          description?: string | null
          id?: string
          name: string
          price: number
          quantity: number
          unit: string
        }
        Update: {
          created_at?: string
          delivery_record_id?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_delivery_record_id_fkey"
            columns: ["delivery_record_id"]
            isOneToOne: false
            referencedRelation: "delivery_records"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          price_per_liter: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_per_liter: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_per_liter?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_name: string
          id: string
          payment_date: string
          payment_method: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_name: string
          id?: string
          payment_date: string
          payment_method?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string
          id?: string
          payment_date?: string
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_name_fkey"
            columns: ["customer_name"]
            isOneToOne: false
            referencedRelation: "customer_balances_view"
            referencedColumns: ["customer_name"]
          },
          {
            foreignKeyName: "payments_customer_name_fkey"
            columns: ["customer_name"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Views: {
      customer_balances_view: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          pending_amount: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
