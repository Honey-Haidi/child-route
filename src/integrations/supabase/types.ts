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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          meta: Json
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          meta?: Json
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          meta?: Json
        }
        Relationships: []
      }
      children: {
        Row: {
          active: boolean
          created_at: string
          emergency_contact: string | null
          grade: string | null
          home_address: string | null
          home_geofence_m: number
          home_lat: number
          home_lng: number
          id: string
          is_demo: boolean
          name: string
          parent_id: string | null
          photo_url: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emergency_contact?: string | null
          grade?: string | null
          home_address?: string | null
          home_geofence_m?: number
          home_lat: number
          home_lng: number
          id?: string
          is_demo?: boolean
          name: string
          parent_id?: string | null
          photo_url?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emergency_contact?: string | null
          grade?: string | null
          home_address?: string | null
          home_geofence_m?: number
          home_lat?: number
          home_lng?: number
          id?: string
          is_demo?: boolean
          name?: string
          parent_id?: string | null
          photo_url?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          license_expiry: string | null
          license_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          license_expiry?: string | null
          license_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          license_expiry?: string | null
          license_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_history: {
        Row: {
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          child_id: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          trip_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body: string
          child_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string
          child_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          phone: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_children: {
        Row: {
          child_id: string
          id: string
          route_id: string
          seq: number
        }
        Insert: {
          child_id: string
          id?: string
          route_id: string
          seq?: number
        }
        Update: {
          child_id?: string
          id?: string
          route_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_children_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          id: string
          label: string
          lat: number
          lng: number
          route_id: string
          seq: number
        }
        Insert: {
          id?: string
          label: string
          lat: number
          lng: number
          route_id: string
          seq: number
        }
        Update: {
          id?: string
          label?: string
          lat?: number
          lng?: number
          route_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string | null
          est_minutes: number
          id: string
          name: string
          school_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          est_minutes?: number
          id?: string
          name: string
          school_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string | null
          est_minutes?: number
          id?: string
          name?: string
          school_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          geofence_m: number
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          geofence_m?: number
          id?: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          geofence_m?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: []
      }
      trip_children: {
        Row: {
          absent_reason: string | null
          child_id: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropped_at: string | null
          id: string
          picked_at: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          seq: number
          status: Database["public"]["Enums"]["child_trip_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          absent_reason?: string | null
          child_id: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropped_at?: string | null
          id?: string
          picked_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          seq?: number
          status?: Database["public"]["Enums"]["child_trip_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          absent_reason?: string | null
          child_id?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropped_at?: string | null
          id?: string
          picked_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          seq?: number
          status?: Database["public"]["Enums"]["child_trip_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_children_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          child_id: string | null
          created_at: string
          id: number
          payload: Json
          trip_id: string
          type: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          trip_id: string
          type: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          trip_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          eta_at: string | null
          id: string
          note: string | null
          route_id: string
          started_at: string
          status: Database["public"]["Enums"]["trip_status"]
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          ended_at?: string | null
          eta_at?: string | null
          id?: string
          note?: string | null
          route_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status"]
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          eta_at?: string | null
          id?: string
          note?: string | null
          route_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status"]
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
      vehicle_live: {
        Row: {
          accuracy: number | null
          heading: number | null
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_live_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          driver_id: string | null
          id: string
          reg_no: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          driver_id?: string | null
          id?: string
          reg_no: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          driver_id?: string | null
          id?: string
          reg_no?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      child_on_driver_trip: { Args: { _child_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_parent_of: { Args: { _child_id: string }; Returns: boolean }
      is_trip_driver: { Args: { _trip_id: string }; Returns: boolean }
      parent_can_see_trip: { Args: { _trip_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "driver" | "parent"
      child_trip_status:
        | "WAITING_FOR_PICKUP"
        | "DRIVER_APPROACHING"
        | "PICKED_UP"
        | "ON_THE_WAY"
        | "ARRIVED_AT_SCHOOL"
        | "DROPPED_OFF"
        | "ABSENT"
        | "CANCELLED"
      trip_status:
        | "SCHEDULED"
        | "STARTED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "DELAYED"
      trip_type: "MORNING_HOME_TO_SCHOOL" | "AFTERNOON_SCHOOL_TO_HOME"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "driver", "parent"],
      child_trip_status: [
        "WAITING_FOR_PICKUP",
        "DRIVER_APPROACHING",
        "PICKED_UP",
        "ON_THE_WAY",
        "ARRIVED_AT_SCHOOL",
        "DROPPED_OFF",
        "ABSENT",
        "CANCELLED",
      ],
      trip_status: [
        "SCHEDULED",
        "STARTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "DELAYED",
      ],
      trip_type: ["MORNING_HOME_TO_SCHOOL", "AFTERNOON_SCHOOL_TO_HOME"],
    },
  },
} as const
