
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "barber_services": {
                  Row: {
                    "barber_id": string,"service_id": string,"shop_id": string
                  }
                  Insert: {
                    "barber_id": string,"service_id": string,"shop_id": string
                  }
                  Update: {
                    "barber_id"?: string,"service_id"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "barber_services_barber_id_shop_id_fkey"
      columns: ["barber_id","shop_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "barber_services_service_id_shop_id_fkey"
      columns: ["service_id","shop_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","shop_id"]
    }
                  ]
                },"barbers": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"display_name": string,"id": string,"is_active": boolean,"shop_id": string,"sort_order": number,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"is_active"?: boolean,"shop_id": string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"shop_id"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "barbers_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barbers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "barber_id": string,"cancellation_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"customer_id": string,"customer_notes": string | null,"duration_minutes": number,"ends_at": string,"id": string,"price_paise": number,"service_id": string,"shop_id": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  Insert: {
                    "barber_id": string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"customer_id": string,"customer_notes"?: string | null,"duration_minutes": number,"ends_at": string,"id"?: string,"price_paise": number,"service_id": string,"shop_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "barber_id"?: string,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"customer_id"?: string,"customer_notes"?: string | null,"duration_minutes"?: number,"ends_at"?: string,"id"?: string,"price_paise"?: number,"service_id"?: string,"shop_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_barber_id_shop_id_fkey"
      columns: ["barber_id","shop_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "bookings_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_shop_id_fkey"
      columns: ["service_id","shop_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "bookings_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"booking_id": string,"created_at": string,"currency": string,"id": string,"provider_payload": Json | null,"razorpay_order_id": string | null,"razorpay_payment_id": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  Insert: {
                    "amount_paise": number,"booking_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"provider_payload"?: Json | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"booking_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"provider_payload"?: Json | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "created_at": string,"description": string | null,"duration_minutes": number,"id": string,"is_active": boolean,"name": string,"price_paise": number,"shop_id": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"duration_minutes": number,"id"?: string,"is_active"?: boolean,"name": string,"price_paise": number,"shop_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"price_paise"?: number,"shop_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["shop_role"],"shop_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["shop_role"],"shop_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["shop_role"],"shop_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_members_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "address_line": string,"approved_at": string | null,"approved_by": string | null,"area": string | null,"cancellation_cutoff_minutes": number,"city": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"location": unknown,"max_days_ahead": number,"name": string,"phone": string | null,"postal_code": string | null,"slot_interval_minutes": number,"slug": string,"state": string,"updated_at": string
                  }
                  Insert: {
                    "address_line": string,"approved_at"?: string | null,"approved_by"?: string | null,"area"?: string | null,"cancellation_cutoff_minutes"?: number,"city"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"location": unknown,"max_days_ahead"?: number,"name": string,"phone"?: string | null,"postal_code"?: string | null,"slot_interval_minutes"?: number,"slug": string,"state"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address_line"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"area"?: string | null,"cancellation_cutoff_minutes"?: number,"city"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"location"?: unknown,"max_days_ahead"?: number,"name"?: string,"phone"?: string | null,"postal_code"?: string | null,"slot_interval_minutes"?: number,"slug"?: string,"state"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shops_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shops_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"time_off": {
                  Row: {
                    "barber_id": string,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"reason": string | null,"shop_id": string,"starts_at": string
                  }
                  Insert: {
                    "barber_id": string,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"reason"?: string | null,"shop_id": string,"starts_at": string
                  }
                  Update: {
                    "barber_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"reason"?: string | null,"shop_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_off_barber_id_shop_id_fkey"
      columns: ["barber_id","shop_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id","shop_id"]
    },{
      foreignKeyName: "time_off_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"working_hours": {
                  Row: {
                    "barber_id": string,"created_at": string,"end_time": string,"id": string,"shop_id": string,"start_time": string,"weekday": number
                  }
                  Insert: {
                    "barber_id": string,"created_at"?: string,"end_time": string,"id"?: string,"shop_id": string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "barber_id"?: string,"created_at"?: string,"end_time"?: string,"id"?: string,"shop_id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "working_hours_barber_id_shop_id_fkey"
      columns: ["barber_id","shop_id"]
isOneToOne: false
      referencedRelation: "barbers"
      referencedColumns: ["id","shop_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "approve_shop":
{ Args: { "p_shop_id": string }; Returns: {
              "address_line": string,
"approved_at": string | null,
"approved_by": string | null,
"area": string | null,
"cancellation_cutoff_minutes": number,
"city": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"is_active": boolean,
"location": unknown,
"max_days_ahead": number,
"name": string,
"phone": string | null,
"postal_code": string | null,
"slot_interval_minutes": number,
"slug": string,
"state": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "shops"
        isOneToOne: true
        isSetofReturn: false
      } },
"book_appointment":
{ Args: { "p_barber_id": string,"p_customer_notes"?: string,"p_service_id": string,"p_starts_at": string }; Returns: {
              "barber_id": string,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"created_at": string,
"customer_id": string,
"customer_notes": string | null,
"duration_minutes": number,
"ends_at": string,
"id": string,
"price_paise": number,
"service_id": string,
"shop_id": string,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_booking":
{ Args: { "p_booking_id": string,"p_reason"?: string }; Returns: {
              "barber_id": string,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"created_at": string,
"customer_id": string,
"customer_notes": string | null,
"duration_minutes": number,
"ends_at": string,
"id": string,
"price_paise": number,
"service_id": string,
"shop_id": string,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_shop":
{ Args: { "p_address_line": string,"p_area"?: string,"p_city"?: string,"p_description"?: string,"p_lat": number,"p_lng": number,"p_name": string,"p_phone"?: string,"p_postal_code"?: string,"p_slug": string }; Returns: {
              "address_line": string,
"approved_at": string | null,
"approved_by": string | null,
"area": string | null,
"cancellation_cutoff_minutes": number,
"city": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"is_active": boolean,
"location": unknown,
"max_days_ahead": number,
"name": string,
"phone": string | null,
"postal_code": string | null,
"slot_interval_minutes": number,
"slug": string,
"state": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "shops"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_available_slots":
{ Args: { "p_barber_id": string,"p_date": string,"p_service_id": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"nearby_shops":
{ Args: { "p_lat": number,"p_lng": number,"p_radius_m"?: number }; Returns: {
              "address_line": string,"area": string,"city": string,"distance_m": number,"id": string,"lat": number,"lng": number,"name": string,"phone": string,"slug": string
            }[]
                           },
"suspend_shop":
{ Args: { "p_shop_id": string }; Returns: {
              "address_line": string,
"approved_at": string | null,
"approved_by": string | null,
"area": string | null,
"cancellation_cutoff_minutes": number,
"city": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"id": string,
"is_active": boolean,
"location": unknown,
"max_days_ahead": number,
"name": string,
"phone": string | null,
"postal_code": string | null,
"slot_interval_minutes": number,
"slug": string,
"state": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "shops"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_booking_status":
{ Args: { "p_booking_id": string,"p_status": Database["public"]['Enums']["booking_status"] }; Returns: {
              "barber_id": string,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"created_at": string,
"customer_id": string,
"customer_notes": string | null,
"duration_minutes": number,
"ends_at": string,
"id": string,
"price_paise": number,
"service_id": string,
"shop_id": string,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "booking_status": "pending"|"confirmed"|"completed"|"cancelled"|"no_show","payment_status": "created"|"authorized"|"captured"|"failed"|"refunded","shop_role": "owner"|"manager"|"barber"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "booking_status": ["pending", "confirmed", "completed", "cancelled", "no_show"],"payment_status": ["created", "authorized", "captured", "failed", "refunded"],"shop_role": ["owner", "manager", "barber"]
          }
        }
} as const
