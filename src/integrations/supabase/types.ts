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
      customer_milk_prices: {
        Row: {
          created_at: string
          customer_id: number | null
          id: number
          milk_type_id: number | null
          price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: number | null
          id?: number
          milk_type_id?: number | null
          price: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: number | null
          id?: number
          milk_type_id?: number | null
          price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_milk_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_milk_prices_milk_type_id_fkey"
            columns: ["milk_type_id"]
            isOneToOne: false
            referencedRelation: "milk_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: number
          name: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: number
          name: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: number
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      entry_grocery_items: {
        Row: {
          created_at: string
          grocery_item_id: number | null
          id: number
          milk_entry_id: number | null
          price: number
          quantity: number
          unit: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          grocery_item_id?: number | null
          id?: number
          milk_entry_id?: number | null
          price: number
          quantity?: number
          unit?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          grocery_item_id?: number | null
          id?: number
          milk_entry_id?: number | null
          price?: number
          quantity?: number
          unit?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_grocery_items_grocery_item_id_fkey"
            columns: ["grocery_item_id"]
            isOneToOne: false
            referencedRelation: "grocery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_grocery_items_milk_entry_id_fkey"
            columns: ["milk_entry_id"]
            isOneToOne: false
            referencedRelation: "milk_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_items: {
        Row: {
          created_at: string
          id: number
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      milk_entries: {
        Row: {
          created_at: string
          customer_id: number | null
          entry_date: string
          id: number
          milk_type_id: number | null
          quantity_ml: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: number | null
          entry_date: string
          id?: number
          milk_type_id?: number | null
          quantity_ml: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: number | null
          entry_date?: string
          id?: number
          milk_type_id?: number | null
          quantity_ml?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_milk_type_id_fkey"
            columns: ["milk_type_id"]
            isOneToOne: false
            referencedRelation: "milk_types"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_types: {
        Row: {
          created_at: string
          id: number
          name: string
          price: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          price: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          price?: number
          user_id?: string | null
        }
        Relationships: []
      }
      "Narmada Dairy": {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
