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
        PostgrestVersion: "14.15"
    }
    public: {
        Tables: {
            brand_kits: {
                Row: {
                    anon_token: string | null
                    brand_positioning: Json | null
                    created_at: string
                    error_code: string | null
                    error_message: string | null
                    error_status: number | null
                    expires_at: string | null
                    id: string
                    imagery_style: Json | null
                    is_public: boolean
                    motion_style: Json | null
                    name: string
                    share_token: string | null
                    source_type: string
                    source_url: string | null
                    status: string
                    typography_scale: Json | null
                    updated_at: string
                    user_id: string | null
                }
                Insert: {
                    anon_token?: string | null
                    brand_positioning?: Json | null
                    created_at?: string
                    error_code?: string | null
                    error_message?: string | null
                    error_status?: number | null
                    expires_at?: string | null
                    id?: string
                    imagery_style?: Json | null
                    is_public?: boolean
                    motion_style?: Json | null
                    name?: string
                    share_token?: string | null
                    source_type?: string
                    source_url?: string | null
                    status?: string
                    typography_scale?: Json | null
                    updated_at?: string
                    user_id?: string | null
                }
                Update: {
                    anon_token?: string | null
                    brand_positioning?: Json | null
                    created_at?: string
                    error_code?: string | null
                    error_message?: string | null
                    error_status?: number | null
                    expires_at?: string | null
                    id?: string
                    imagery_style?: Json | null
                    is_public?: boolean
                    motion_style?: Json | null
                    name?: string
                    share_token?: string | null
                    source_type?: string
                    source_url?: string | null
                    status?: string
                    typography_scale?: Json | null
                    updated_at?: string
                    user_id?: string | null
                }
                Relationships: []
            }
            design_doc_versions: {
                Row: {
                    created_at: string
                    created_by: string | null
                    id: string
                    label: string | null
                    markdown: string
                    parsed: Json
                    version: number
                }
                Insert: {
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    label?: string | null
                    markdown: string
                    parsed?: Json
                    version: number
                }
                Update: {
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    label?: string | null
                    markdown?: string
                    parsed?: Json
                    version?: number
                }
                Relationships: []
            }
            kit_assets: {
                Row: {
                    created_at: string
                    height: number | null
                    id: string
                    kind: string
                    kit_id: string
                    position: number
                    storage_path: string | null
                    url: string
                    width: number | null
                }
                Insert: {
                    created_at?: string
                    height?: number | null
                    id?: string
                    kind: string
                    kit_id: string
                    position?: number
                    storage_path?: string | null
                    url: string
                    width?: number | null
                }
                Update: {
                    created_at?: string
                    height?: number | null
                    id?: string
                    kind?: string
                    kit_id?: string
                    position?: number
                    storage_path?: string | null
                    url?: string
                    width?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "kit_assets_kit_id_fkey"
                        columns: ["kit_id"]
                        isOneToOne: false
                        referencedRelation: "brand_kits"
                        referencedColumns: ["id"]
                    },
                ]
            }
            kit_colors: {
                Row: {
                    created_at: string
                    hex: string
                    id: string
                    kit_id: string
                    locked: boolean
                    name: string | null
                    position: number
                    role: string | null
                }
                Insert: {
                    created_at?: string
                    hex: string
                    id?: string
                    kit_id: string
                    locked?: boolean
                    name?: string | null
                    position?: number
                    role?: string | null
                }
                Update: {
                    created_at?: string
                    hex?: string
                    id?: string
                    kit_id?: string
                    locked?: boolean
                    name?: string | null
                    position?: number
                    role?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "kit_colors_kit_id_fkey"
                        columns: ["kit_id"]
                        isOneToOne: false
                        referencedRelation: "brand_kits"
                        referencedColumns: ["id"]
                    },
                ]
            }
            kit_fonts: {
                Row: {
                    created_at: string
                    family: string
                    file_urls: Json | null
                    google_font: boolean | null
                    id: string
                    is_substitute: boolean
                    kit_id: string
                    license: string | null
                    license_note: string | null
                    position: number
                    provider: string | null
                    provider_url: string | null
                    role: string | null
                    scale: Json | null
                    source_family: string | null
                    weights: string[] | null
                }
                Insert: {
                    created_at?: string
                    family: string
                    file_urls?: Json | null
                    google_font?: boolean | null
                    id?: string
                    is_substitute?: boolean
                    kit_id: string
                    license?: string | null
                    license_note?: string | null
                    position?: number
                    provider?: string | null
                    provider_url?: string | null
                    role?: string | null
                    scale?: Json | null
                    source_family?: string | null
                    weights?: string[] | null
                }
                Update: {
                    created_at?: string
                    family?: string
                    file_urls?: Json | null
                    google_font?: boolean | null
                    id?: string
                    is_substitute?: boolean
                    kit_id?: string
                    license?: string | null
                    license_note?: string | null
                    position?: number
                    provider?: string | null
                    provider_url?: string | null
                    role?: string | null
                    scale?: Json | null
                    source_family?: string | null
                    weights?: string[] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "kit_fonts_kit_id_fkey"
                        columns: ["kit_id"]
                        isOneToOne: false
                        referencedRelation: "brand_kits"
                        referencedColumns: ["id"]
                    },
                ]
            }
            kit_tokens: {
                Row: {
                    category: string
                    created_at: string
                    id: string
                    kit_id: string
                    name: string
                    position: number
                    value: string
                }
                Insert: {
                    category: string
                    created_at?: string
                    id?: string
                    kit_id: string
                    name: string
                    position?: number
                    value: string
                }
                Update: {
                    category?: string
                    created_at?: string
                    id?: string
                    kit_id?: string
                    name?: string
                    position?: number
                    value?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "kit_tokens_kit_id_fkey"
                        columns: ["kit_id"]
                        isOneToOne: false
                        referencedRelation: "brand_kits"
                        referencedColumns: ["id"]
                    },
                ]
            }
            kit_voice: {
                Row: {
                    created_at: string
                    donts: Json | null
                    dos: Json | null
                    id: string
                    kit_id: string
                    samples: Json | null
                    summary: string | null
                    tone: Json | null
                    updated_at: string
                    vocabulary: Json | null
                }
                Insert: {
                    created_at?: string
                    donts?: Json | null
                    dos?: Json | null
                    id?: string
                    kit_id: string
                    samples?: Json | null
                    summary?: string | null
                    tone?: Json | null
                    updated_at?: string
                    vocabulary?: Json | null
                }
                Update: {
                    created_at?: string
                    donts?: Json | null
                    dos?: Json | null
                    id?: string
                    kit_id?: string
                    samples?: Json | null
                    summary?: string | null
                    tone?: Json | null
                    updated_at?: string
                    vocabulary?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "kit_voice_kit_id_fkey"
                        columns: ["kit_id"]
                        isOneToOne: true
                        referencedRelation: "brand_kits"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    created_at: string
                    display_name: string | null
                    id: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string
                    display_name?: string | null
                    id?: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string
                    display_name?: string | null
                    id?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: []
            }
            user_roles: {
                Row: {
                    created_at: string
                    id: string
                    role: Database["public"]["Enums"]["app_role"]
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    role: Database["public"]["Enums"]["app_role"]
                    user_id: string
                }
                Update: {
                    created_at?: string
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
            has_role: {
                Args: {
                    _role: Database["public"]["Enums"]["app_role"]
                    _user_id: string
                }
                Returns: boolean
            }
        }
        Enums: {
            app_role: "admin" | "user"
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
            app_role: ["admin", "user"],
        },
    },
} as const
