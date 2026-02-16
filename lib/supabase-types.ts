type TasksRow = {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  day: string;
  created_at: string;
};

type ProfilesRow = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: TasksRow;
        Insert: {
          id?: string;
          user_id: string;
          text: string;
          completed?: boolean;
          day: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          text?: string;
          completed?: boolean;
          day?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfilesRow;
        Insert: {
          id: string;
          email: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
