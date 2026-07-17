export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cohorts: {
        Row: {
          created_at: string | null
          ends_on: string | null
          id: string
          name: string
          starts_on: string | null
        }
        Insert: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          name: string
          starts_on?: string | null
        }
        Update: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string | null
        }
        Relationships: []
      }
      discussion_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          parent_id: string | null
          position: number
          speaker_id: string | null
          speaker_name: string | null
          topic_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          speaker_id?: string | null
          speaker_name?: string | null
          topic_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          position?: number
          speaker_id?: string | null
          speaker_name?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_messages_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "member_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          cohort_id: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          member_id: string | null
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          member_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          member_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_drafts: {
        Row: {
          chat_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          payload: Json
          source: string
          status: string
          updated_at: string | null
        }
        Insert: {
          chat_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          payload: Json
          source?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          chat_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          payload?: Json
          source?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      topic_contributors: {
        Row: {
          member_id: string
          topic_id: string
        }
        Insert: {
          member_id: string
          topic_id: string
        }
        Update: {
          member_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_contributors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_contributors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_contributors_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          asker_id: string | null
          category: string | null
          code: string
          cohort_id: string | null
          conclusion: string | null
          created_at: string | null
          created_by: string | null
          discussion: string | null
          id: string
          status: Database["public"]["Enums"]["topic_status"]
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          asker_id?: string | null
          category?: string | null
          code?: string
          cohort_id?: string | null
          conclusion?: string | null
          created_at?: string | null
          created_by?: string | null
          discussion?: string | null
          id?: string
          status?: Database["public"]["Enums"]["topic_status"]
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          asker_id?: string | null
          category?: string | null
          code?: string
          cohort_id?: string | null
          conclusion?: string | null
          created_at?: string | null
          created_by?: string | null
          discussion?: string | null
          id?: string
          status?: Database["public"]["Enums"]["topic_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "member_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      member_engagement: {
        Row: {
          answered: number | null
          asked: number | null
          cohort_id: string | null
          id: string | null
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["member_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string | null
          role: Database["public"]["Enums"]["member_role"]
          created_at: string | null
          last_sign_in_at: string | null
        }[]
      }
      admin_create_user: {
        Args: {
          p_email: string
          p_password: string
          p_role?: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      admin_update_user: {
        Args: {
          p_user_id: string
          p_role?: Database["public"]["Enums"]["member_role"] | null
          p_password?: string | null
        }
        Returns: undefined
      }
      admin_delete_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      member_role: "student" | "admin"
      topic_status: "讨论中" | "已结论" | "待跟进"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]

export type MemberRole = Enums<"member_role">
export type TopicStatus = Enums<"topic_status">

export const Constants = {
  public: {
    Enums: {
      member_role: ["student", "admin"],
      topic_status: ["讨论中", "已结论", "待跟进"],
    },
  },
} as const
