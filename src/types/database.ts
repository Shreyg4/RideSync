export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      saved_trips: {
        Row: {
          id: number;
          image_url: string | null;
          name: string;
          saved_at: string;
          stops: Json;
          trip_type: string;
          user_id: string;
        };
        Insert: {
          id?: never;
          image_url?: string | null;
          name: string;
          saved_at?: string;
          stops?: Json;
          trip_type: string;
          user_id: string;
        };
        Update: {
          id?: never;
          image_url?: string | null;
          name?: string;
          saved_at?: string;
          stops?: Json;
          trip_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_trips_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      storage_cleanup_queue: {
        Row: {
          bucket_id: string;
          path: string;
          queued_at: string;
        };
        Insert: {
          bucket_id: string;
          path: string;
          queued_at?: string;
        };
        Update: {
          bucket_id?: string;
          path?: string;
          queued_at?: string;
        };
        Relationships: [];
      };
      trip_members: {
        Row: {
          joined_at: string;
          role: string;
          trip_id: number;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: string;
          trip_id: number;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          role?: string;
          trip_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_members_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_stops: {
        Row: {
          address: string | null;
          category: string;
          created_at: string;
          departs_at: string | null;
          id: number;
          is_turnaround: boolean;
          lat: number;
          lng: number;
          mapbox_id: string | null;
          name: string;
          notes: string | null;
          position: number;
          stop_type: string;
          trip_id: number;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          category?: string;
          created_at?: string;
          departs_at?: string | null;
          id?: never;
          is_turnaround?: boolean;
          lat: number;
          lng: number;
          mapbox_id?: string | null;
          name: string;
          notes?: string | null;
          position: number;
          stop_type?: string;
          trip_id: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          category?: string;
          created_at?: string;
          departs_at?: string | null;
          id?: never;
          is_turnaround?: boolean;
          lat?: number;
          lng?: number;
          mapbox_id?: string | null;
          name?: string;
          notes?: string | null;
          position?: number;
          stop_type?: string;
          trip_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_stops_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          created_at: string;
          id: number;
          image_url: string | null;
          invite_link: string;
          name: string;
          owner_id: string;
          starts_at: string;
          trip_status: string;
          trip_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          image_url?: string | null;
          invite_link?: string;
          name: string;
          owner_id?: string;
          starts_at: string;
          trip_status?: string;
          trip_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          image_url?: string | null;
          invite_link?: string;
          name?: string;
          owner_id?: string;
          starts_at?: string;
          trip_status?: string;
          trip_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          display_name: string | null;
          first_name: string;
          id: string;
          last_name: string;
          show_full_name: boolean;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string | null;
          first_name: string;
          id: string;
          last_name: string;
          show_full_name?: boolean;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string;
          show_full_name?: boolean;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_trip_stop: {
        Args: {
          at_position?: number;
          new_stop_type?: string;
          stop_address?: string;
          stop_category?: string;
          stop_is_turnaround?: boolean;
          stop_lat: number;
          stop_lng: number;
          stop_mapbox_id?: string;
          stop_name: string;
          stop_notes?: string;
          target_trip_id: number;
        };
        Returns: {
          address: string | null;
          category: string;
          created_at: string;
          departs_at: string | null;
          id: number;
          is_turnaround: boolean;
          lat: number;
          lng: number;
          mapbox_id: string | null;
          name: string;
          notes: string | null;
          position: number;
          stop_type: string;
          trip_id: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'trip_stops';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      archive_stale_trips: { Args: never; Returns: undefined };
      archive_trip: { Args: { target_trip_id: number }; Returns: undefined };
      cancel_trip: { Args: { target_trip_id: number }; Returns: undefined };
      generate_join_code: { Args: never; Returns: string };
      join_trip: { Args: { code: string }; Returns: number };
      leave_trip: { Args: { target_trip_id: number }; Returns: undefined };
      list_trip_members: {
        Args: { target_trip_id: number };
        Returns: {
          avatar_path: string;
          display_name: string;
          joined_at: string;
          role: string;
          user_id: string;
        }[];
      };
      pass_trip_ownership: {
        Args: { old_owner_id: string; target_trip_id: number };
        Returns: boolean;
      };
      remove_trip_stop: { Args: { target_stop_id: number }; Returns: undefined };
      reorder_trip_stops: {
        Args: { ordered_ids: number[]; target_trip_id: number };
        Returns: undefined;
      };
      start_saved_trip: {
        Args: { new_starts_at: string; saved_trip_id: number };
        Returns: number;
      };
      transfer_trip_ownership: {
        Args: { new_owner_id: string; target_trip_id: number };
        Returns: undefined;
      };
      trip_role: { Args: { target_trip_id: number }; Returns: string };
      username_available: { Args: { candidate: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
